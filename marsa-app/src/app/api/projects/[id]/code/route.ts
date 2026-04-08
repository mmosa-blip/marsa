import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProjectCode } from "@/lib/project-code";
import { createAuditLog, AuditModule } from "@/lib/audit";

/**
 * PATCH /api/projects/:id/code
 *
 * Body: { contractNumber: number | null }
 *
 * Edits the contractNumber of the project's linked contract (the one in
 * Project.contractId) and regenerates this project's projectCode. The
 * project's existing projectSeq is preserved so only the contract segment
 * of the code changes.
 *
 * If the project has no linked contract, returns 400 — there's nothing to
 * renumber.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
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

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        clientId: true,
        departmentId: true,
        contractId: true,
        projectSeq: true,
        createdAt: true,
        projectCode: true,
      },
    });
    if (!project || !project.contractId) {
      return NextResponse.json(
        { error: "المشروع لا يحتوي على عقد مرتبط" },
        { status: 400 }
      );
    }

    // Uniqueness pre-check on the contract number — friendlier error than
    // letting the @unique constraint blow up.
    if (parsed !== null) {
      const collision = await prisma.contract.findFirst({
        where: { contractNumber: parsed, id: { not: project.contractId } },
        select: { id: true },
      });
      if (collision) {
        return NextResponse.json(
          { error: "رقم العقد مستخدم مسبقاً" },
          { status: 409 }
        );
      }
    }

    // 1. Persist the new contract number.
    await prisma.contract.update({
      where: { id: project.contractId },
      data: { contractNumber: parsed },
    });

    // 2. Regenerate this project's code, preserving its seq.
    const { code } = await generateProjectCode(prisma, {
      clientId: project.clientId,
      departmentId: project.departmentId,
      contractId: project.contractId,
      contractNumberOverride: parsed,
      seqOverride: project.projectSeq,
      year: project.createdAt.getFullYear(),
    });
    const updated = await prisma.project.update({
      where: { id },
      data: { projectCode: code },
      select: { id: true, projectCode: true, projectSeq: true },
    });

    // 3. Cascade to any sibling projects that share this contract — they
    //    were generated from the same contractNumber, so their codes need
    //    to update too.
    const siblings = await prisma.project.findMany({
      where: { contractId: project.contractId, id: { not: id } },
      select: { id: true, clientId: true, departmentId: true, projectSeq: true, createdAt: true },
    });
    for (const s of siblings) {
      const { code: siblingCode } = await generateProjectCode(prisma, {
        clientId: s.clientId,
        departmentId: s.departmentId,
        contractId: project.contractId,
        contractNumberOverride: parsed,
        seqOverride: s.projectSeq,
        year: s.createdAt.getFullYear(),
      });
      await prisma.project.update({
        where: { id: s.id },
        data: { projectCode: siblingCode },
      });
    }

    createAuditLog({
      userId: session.user.id,
      userName: session.user.name || undefined,
      userRole: session.user.role,
      action: "PROJECT_RENUMBERED",
      module: AuditModule.PROJECTS,
      entityType: "Project",
      entityId: id,
      entityName: project.name,
      before: { projectCode: project.projectCode },
      after: { projectCode: code, contractNumber: parsed, siblingsCascaded: siblings.length },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error renumbering project:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
