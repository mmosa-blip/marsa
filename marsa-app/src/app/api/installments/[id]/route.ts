import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { can, PERMISSIONS } from "@/lib/permissions";

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
    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    const installment = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            template: { select: { title: true } },
            client: { select: { id: true, name: true } },
          },
        },
        linkedTask: { select: { id: true, title: true, status: true } },
        tickets: true,
      },
    });

    if (!installment) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    // Access check: admin/manager or contract client
    if (!isAdmin && installment.contract.client.id !== userId) {
      return NextResponse.json({ error: "غير مصرح بالوصول لهذه الدفعة" }, { status: 403 });
    }

    return NextResponse.json(installment);
  } catch (error) {
    console.error("Error fetching installment:", error);
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
    const { action, paidAmount, taskId } = body;

    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);
    const isFinance = role === "FINANCE_MANAGER";

    const installment = await prisma.contractPaymentInstallment.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            template: { select: { title: true } },
            client: { select: { id: true, name: true } },
          },
        },
        linkedTask: { select: { id: true, title: true, status: true } },
      },
    });

    if (!installment) {
      return NextResponse.json({ error: "الدفعة غير موجودة" }, { status: 404 });
    }

    // ─── mark_paid: set paymentStatus = PAID ───
    if (action === "mark_paid") {
      if (!(await can(userId, role, PERMISSIONS.FINANCE_INSTALLMENTS))) {
        return NextResponse.json({ error: "غير مصرح بتحديث حالة الدفع" }, { status: 403 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {
        paymentStatus: "PAID",
        paidAmount: installment.amount,
        paidAt: new Date(),
      };

      // Auto-unlock if linked task is locked
      if (installment.linkedTaskId && installment.isLocked) {
        data.isLocked = false;
      }

      const updated = await prisma.contractPaymentInstallment.update({
        where: { id },
        data,
        include: {
          contract: { include: { template: { select: { title: true } }, client: { select: { id: true, name: true } } } },
          linkedTask: { select: { id: true, title: true, status: true } },
        },
      });

      // Notify client
      await prisma.notification.create({
        data: {
          userId: installment.contract.clientId,
          type: "INVOICE_PAID" as const,
          message: `تم تأكيد دفع الدفعة: ${installment.title} - عقد: ${installment.contract.template.title}`,
          link: `/dashboard/contracts`,
        },
      });

      // Notify linked task assignee that task is now unlocked
      if (installment.linkedTaskId && installment.isLocked) {
        const linkedTask = await prisma.task.findUnique({
          where: { id: installment.linkedTaskId },
          select: { assigneeId: true, title: true },
        });
        if (linkedTask?.assigneeId) {
          await prisma.notification.create({
            data: {
              userId: linkedTask.assigneeId,
              type: "TASK_UPDATE" as const,
              message: `تم فتح المهمة "${linkedTask.title}" بعد تأكيد الدفع`,
              link: `/dashboard/my-tasks`,
            },
          });
        }
      }

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "INSTALLMENT_PAID", module: AuditModule.FINANCE,
        severity: "CRITICAL",
        entityType: "Installment", entityId: id, entityName: installment.contract.template.title,
        after: { amount: installment.amount, paymentStatus: "PAID" },
      });

      return NextResponse.json(updated);
    }

    // ─── partial_pay: set paymentStatus = PARTIAL ───
    if (action === "partial_pay") {
      if (!(await can(userId, role, PERMISSIONS.FINANCE_INSTALLMENTS))) {
        return NextResponse.json({ error: "غير مصرح بتحديث حالة الدفع" }, { status: 403 });
      }
      if (paidAmount === undefined || paidAmount === null) {
        return NextResponse.json({ error: "يجب تحديد المبلغ المدفوع" }, { status: 400 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {
        paymentStatus: "PARTIAL",
        paidAmount,
        paidAt: new Date(),
      };

      // Auto-unlock if linked task is locked
      if (installment.linkedTaskId && installment.isLocked) {
        data.isLocked = false;
      }

      const updated = await prisma.contractPaymentInstallment.update({
        where: { id },
        data,
        include: {
          contract: { include: { template: { select: { title: true } }, client: { select: { id: true, name: true } } } },
          linkedTask: { select: { id: true, title: true, status: true } },
        },
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "INSTALLMENT_PARTIAL", module: AuditModule.FINANCE,
        severity: "WARN",
        entityType: "Installment", entityId: id, entityName: installment.contract.template.title,
        after: { paidAmount, paymentStatus: "PARTIAL" },
      });

      return NextResponse.json(updated);
    }

    // ─── lock: set isLocked = true ───
    if (action === "lock") {
      if (!isAdmin && !isFinance) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.contractPaymentInstallment.update({
        where: { id },
        data: { isLocked: true },
      });

      return NextResponse.json(updated);
    }

    // ─── unlock: set isLocked = false ───
    if (action === "unlock") {
      if (!isAdmin && !isFinance) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }

      const updated = await prisma.contractPaymentInstallment.update({
        where: { id },
        data: { isLocked: false },
      });

      return NextResponse.json(updated);
    }

    // ─── link_task: set linkedTaskId ───
    if (action === "link_task") {
      if (!isAdmin) {
        return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
      }
      if (!taskId) {
        return NextResponse.json({ error: "يجب تحديد المهمة" }, { status: 400 });
      }

      const updated = await prisma.contractPaymentInstallment.update({
        where: { id },
        data: { linkedTaskId: taskId },
        include: {
          linkedTask: { select: { id: true, title: true, status: true } },
        },
      });

      return NextResponse.json(updated);
    }

    // ─── approve: set approvedById ───
    if (action === "approve") {
      if (!(await can(userId, role, PERMISSIONS.FINANCE_APPROVE))) {
        return NextResponse.json({ error: "غير مصرح بالاعتماد" }, { status: 403 });
      }

      const updated = await prisma.contractPaymentInstallment.update({
        where: { id },
        data: { approvedById: userId },
      });

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: role,
        action: "INSTALLMENT_APPROVED", module: AuditModule.FINANCE,
        severity: "WARN",
        entityType: "Installment", entityId: id, entityName: installment.contract.template.title,
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (error) {
    console.error("Error updating installment:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
