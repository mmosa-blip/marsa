import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { instantiateProjectFromTemplate } from "@/lib/project-instantiation";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { can, PERMISSIONS } from "@/lib/permissions";
import { generateProjectCode } from "@/lib/project-code";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        template: true,
        client: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, projectCode: true } },
        installments: { orderBy: { order: "asc" } },
        addenda: {
          orderBy: { order: "asc" },
          include: {
            createdBy: { select: { id: true, name: true } },
            approvedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error("Error fetching contract:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, managerNote, clientNote, finalContent } = body;
    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        issuedBy: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        template: { select: { title: true } },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    // ─── ADMIN/MANAGER: edit contractNumber (renumbering) ───
    // Allowed even on SIGNED/ACTIVE contracts because the number is purely
    // organizational metadata. After the update, regenerate projectCode for
    // every project that uses this contract as its primary contract so the
    // codes stay consistent with the new number.
    if (action === "set_contract_number") {
      if (!isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      const raw = body.contractNumber;
      const parsed =
        raw === null || raw === ""
          ? null
          : typeof raw === "number"
            ? raw
            : Number(raw);
      if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
        return NextResponse.json(
          { error: "رقم العقد يجب أن يكون عدداً صحيحاً موجباً" },
          { status: 400 }
        );
      }

      // Uniqueness check (the @unique constraint will reject collisions
      // with a 500, so we surface a friendlier error early).
      if (parsed !== null) {
        const collision = await prisma.contract.findFirst({
          where: { contractNumber: parsed, id: { not: id } },
          select: { id: true },
        });
        if (collision) {
          return NextResponse.json(
            { error: "رقم العقد مستخدم مسبقاً" },
            { status: 409 }
          );
        }
      }

      const updated = await prisma.contract.update({
        where: { id },
        data: { contractNumber: parsed },
      });

      // Cascade: every project whose primary contract is this one gets a
      // regenerated projectCode (using its OWN existing seq so the tail
      // stays stable).
      const linkedProjects = await prisma.project.findMany({
        where: { contractId: id },
        select: { id: true, clientId: true, departmentId: true, projectSeq: true, createdAt: true },
      });
      for (const p of linkedProjects) {
        const { code } = await generateProjectCode(prisma, {
          clientId: p.clientId,
          departmentId: p.departmentId,
          contractId: id,
          contractNumberOverride: parsed,
          seqOverride: p.projectSeq,
        });
        await prisma.project.update({
          where: { id: p.id },
          data: { projectCode: code },
        });
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_RENUMBERED", module: AuditModule.CONTRACTS,
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { contractNumber: contract.contractNumber },
        after: { contractNumber: parsed, projectsCascaded: linkedProjects.length },
      });

      return NextResponse.json(updated);
    }

    // ─── Post-signature lock: block edits on signed/active contracts ───
    const lockedStatuses = ["SIGNED", "ACTIVE"];
    if (lockedStatuses.includes(contract.status) && action !== "activate") {
      return NextResponse.json(
        { error: "العقد موقّع ولا يمكن تعديله. يمكنك إضافة ملحق بدلاً من ذلك." },
        { status: 403 }
      );
    }

    // ─── Edit finalContent (no action, just content update) ───
    if (finalContent !== undefined && !action) {
      // Executor can edit DRAFT or CONTRACT_REVISION
      if (contract.issuedById === userId && ["DRAFT", "CONTRACT_REVISION"].includes(contract.status)) {
        const updated = await prisma.contract.update({
          where: { id },
          data: { finalContent },
        });
        return NextResponse.json(updated);
      }
      // Admin/Manager can edit PENDING_APPROVAL
      if (isAdmin && contract.status === "PENDING_APPROVAL") {
        const updated = await prisma.contract.update({
          where: { id },
          data: { finalContent },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json({ error: "غير مصرح بالتعديل في هذه الحالة" }, { status: 403 });
    }

    // ─── EXECUTOR: submit for approval (DRAFT → PENDING_APPROVAL) ───
    if (action === "submit") {
      if (contract.status !== "DRAFT") {
        return NextResponse.json({ error: "لا يمكن رفع هذا العقد" }, { status: 400 });
      }
      if (contract.issuedById !== userId && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.contract.update({
        where: { id },
        data: { status: "PENDING_APPROVAL" },
      });

      const managers = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (managers.length > 0) {
        await prisma.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            type: "TASK_UPDATE" as const,
            message: `عقد جديد بانتظار اعتمادك: ${contract.template?.title || "عقد"} - العميل: ${contract.client.name}`,
            link: `/dashboard/contracts`,
          })),
        });
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_SUBMITTED", module: AuditModule.CONTRACTS,
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "PENDING_APPROVAL" },
      });

      return NextResponse.json(updated);
    }

    // ─── EXECUTOR: resubmit after revision (CONTRACT_REVISION → PENDING_APPROVAL) ───
    if (action === "resubmit") {
      if (contract.status !== "CONTRACT_REVISION") {
        return NextResponse.json({ error: "لا يمكن إعادة رفع هذا العقد" }, { status: 400 });
      }
      if (contract.issuedById !== userId && !isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.contract.update({
        where: { id },
        data: {
          status: "PENDING_APPROVAL",
          clientNote: null,
          ...(finalContent !== undefined && { finalContent }),
        },
      });

      const managers = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (managers.length > 0) {
        await prisma.notification.createMany({
          data: managers.map((m) => ({
            userId: m.id,
            type: "TASK_UPDATE" as const,
            message: `تم إعادة رفع عقد معدّل: ${contract.template?.title || "عقد"} - العميل: ${contract.client.name}`,
            link: `/dashboard/contracts`,
          })),
        });
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_SUBMITTED", module: AuditModule.CONTRACTS,
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "PENDING_APPROVAL" },
        notes: "إعادة رفع بعد تعديل",
      });

      return NextResponse.json(updated);
    }

    // ─── ADMIN/MANAGER: approve (PENDING_APPROVAL → SENT_TO_CLIENT) ───
    if (action === "approve") {
      if (!(await can(userId, role, PERMISSIONS.CONTRACTS_APPROVE))) {
        return NextResponse.json({ error: "ليس لديك صلاحية لاعتماد العقود" }, { status: 403 });
      }
      if (contract.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "لا يمكن اعتماد هذا العقد" }, { status: 400 });
      }

      // Fetch manager's signature and stamp
      const manager = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, signatureImage: true, stampImage: true },
      });

      const updated = await prisma.contract.update({
        where: { id },
        data: {
          status: "SENT_TO_CLIENT",
          approvedById: userId,
          approvedAt: new Date(),
          sentAt: new Date(),
          managerNote: managerNote || null,
          managerSignatureImage: manager?.signatureImage || null,
          managerStampImage: manager?.stampImage || null,
          managerSignedAt: new Date(),
          managerName: manager?.name || null,
        },
      });

      await prisma.notification.create({
        data: {
          userId: contract.clientId,
          type: "TASK_UPDATE" as const,
          message: `تم إرسال عقد لمراجعتك وتوقيعه: ${contract.template?.title || "عقد"}`,
          link: `/dashboard/contracts`,
        },
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_APPROVED", module: AuditModule.CONTRACTS,
        severity: "WARN",
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "SENT_TO_CLIENT" },
      });

      return NextResponse.json(updated);
    }

    // ─── ADMIN/MANAGER: reject (PENDING_APPROVAL → REJECTED) ───
    if (action === "reject") {
      if (!isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (contract.status !== "PENDING_APPROVAL") {
        return NextResponse.json({ error: "لا يمكن رفض هذا العقد" }, { status: 400 });
      }

      const updated = await prisma.contract.update({
        where: { id },
        data: {
          status: "REJECTED",
          managerNote: managerNote || null,
        },
      });

      await prisma.notification.create({
        data: {
          userId: contract.issuedById,
          type: "TASK_UPDATE" as const,
          message: `تم رفض العقد: ${contract.template?.title || "عقد"}${managerNote ? ` - السبب: ${managerNote}` : ""}`,
          link: `/dashboard/contracts`,
        },
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_REJECTED", module: AuditModule.CONTRACTS,
        severity: "WARN",
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "REJECTED" },
        notes: managerNote || undefined,
      });

      return NextResponse.json(updated);
    }

    // ─── CLIENT: request revision (SENT_TO_CLIENT → CONTRACT_REVISION) ───
    if (action === "request_revision") {
      if (contract.clientId !== userId) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (contract.status !== "SENT_TO_CLIENT") {
        return NextResponse.json({ error: "لا يمكن طلب تعديل لهذا العقد" }, { status: 400 });
      }

      const updated = await prisma.contract.update({
        where: { id },
        data: {
          status: "CONTRACT_REVISION",
          clientNote: clientNote || null,
        },
      });

      // Notify issuer + managers
      const managersToNotify = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      const notifyIds = new Set([contract.issuedById, ...managersToNotify.map((m) => m.id)]);
      await prisma.notification.createMany({
        data: [...notifyIds].map((uid) => ({
          userId: uid,
          type: "TASK_UPDATE" as const,
          message: `طلب العميل ${contract.client.name} تعديلات على العقد: ${contract.template?.title || "عقد"}`,
          link: `/dashboard/contracts`,
        })),
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_REVISION_REQUESTED", module: AuditModule.CONTRACTS,
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "CONTRACT_REVISION" },
        notes: clientNote || undefined,
      });

      return NextResponse.json(updated);
    }

    // ─── CLIENT: sign (SENT_TO_CLIENT → SIGNED) ───
    if (action === "sign") {
      if (contract.status !== "SENT_TO_CLIENT") {
        return NextResponse.json({ error: "لا يمكن توقيع هذا العقد" }, { status: 400 });
      }
      if (contract.clientId !== userId) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const clientSignature = body.clientSignature;
      if (!clientSignature) {
        return NextResponse.json({ error: "التوقيع مطلوب" }, { status: 400 });
      }

      // Get client IP
      const forwarded = request.headers.get("x-forwarded-for");
      const clientIP = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";

      const updated = await prisma.contract.update({
        where: { id },
        data: {
          status: "SIGNED",
          signedAt: new Date(),
          clientSignature,
          clientSignedAt: new Date(),
          clientSignedIP: clientIP,
        },
      });

      const managersToNotify = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true, deletedAt: null },
        select: { id: true },
      });
      const notifyIds = new Set([contract.issuedById, ...managersToNotify.map((m) => m.id)]);
      await prisma.notification.createMany({
        data: [...notifyIds].map((uid) => ({
          userId: uid,
          type: "TASK_UPDATE" as const,
          message: `وقّع العميل ${contract.client.name} على العقد: ${contract.template?.title || "عقد"}`,
          link: `/dashboard/contracts`,
        })),
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_SIGNED", module: AuditModule.CONTRACTS,
        severity: "WARN",
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "SIGNED" },
        meta: { clientIP },
      });

      return NextResponse.json(updated);
    }

    // ─── ADMIN/MANAGER: activate (SIGNED → ACTIVE) + auto-create project ───
    if (action === "activate") {
      if (!isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (contract.status !== "SIGNED") {
        return NextResponse.json({ error: "لا يمكن تفعيل هذا العقد" }, { status: 400 });
      }

      const updated = await prisma.contract.update({
        where: { id },
        data: { status: "ACTIVE" },
      });

      // Auto-instantiate project if templateId is provided in body
      const { templateId: projectTemplateId } = body;
      let projectId: string | null = null;
      if (projectTemplateId) {
        projectId = await instantiateProjectFromTemplate({
          templateId: projectTemplateId,
          clientId: contract.clientId,
          managerId: userId,
          contractId: id,
          name: `مشروع - ${contract.template?.title || "عقد"} - ${contract.client.name}`,
        });
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "CONTRACT_ACTIVATED", module: AuditModule.CONTRACTS,
        severity: "CRITICAL",
        entityType: "Contract", entityId: id,
        entityName: contract.template?.title || "عقد",
        before: { status: contract.status }, after: { status: "ACTIVE", projectId },
      });

      return NextResponse.json({ ...updated, projectId });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error) {
    console.error("Error updating contract:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
