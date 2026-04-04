import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS, hasPermission } from "@/lib/permissions";
import { createAuditLog, AuditModule } from "@/lib/audit";

function mergeVariables(content: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    content
  );
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterClientId = searchParams.get("clientId");
    const filterStatus = searchParams.get("status");

    const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

    const isClient = session.user.role === "CLIENT";

    // Permission check for executor-level roles
    if (!isAdmin && !isClient) {
      const allowed = await can(session.user.id, session.user.role, PERMISSIONS.CONTRACTS_VIEW);
      if (!allowed) {
        return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (isClient) {
      where.clientId = session.user.id;
    } else if (!isAdmin) {
      // Executors see contracts they issued OR where they have assigned tasks
      where.OR = [
        { issuedById: session.user.id },
        { project: { tasks: { some: { assigneeId: session.user.id } } } },
      ];
    }
    // ADMIN/MANAGER see all

    if (filterClientId) where.clientId = filterClientId;
    if (filterStatus) {
      const statuses = filterStatus.split(",");
      where.status = statuses.length > 1 ? { in: statuses } : filterStatus;
    }

    const contracts = await prisma.contract.findMany({
      where,
      include: {
        template: { select: { id: true, title: true } },
        client: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        installments: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(contracts);
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    if (!(await can(session.user.id, session.user.role, PERMISSIONS.CONTRACTS_CREATE))) {
      return NextResponse.json({ error: "ليس لديك صلاحية للقيام بهذا الإجراء" }, { status: 403 });
    }

    const { templateId, clientId, projectId, variables, installments } = await request.json();

    if (!templateId || !clientId || !variables) {
      return NextResponse.json({ error: "بيانات غير مكتملة" }, { status: 400 });
    }

    const template = await prisma.contractTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || !template.isActive) {
      return NextResponse.json({ error: "القالب غير موجود أو غير نشط" }, { status: 404 });
    }

    const finalContent = mergeVariables(template.content, variables);

    // Ensure counter exists, then atomically increment
    await prisma.systemCounter.upsert({
      where: { key: "contract_number" },
      create: { key: "contract_number", value: 999 },
      update: {},
    });
    const counter = await prisma.systemCounter.update({
      where: { key: "contract_number" },
      data: { value: { increment: 1 } },
    });
    const contractNumber = counter.value;

    const contract = await prisma.contract.create({
      data: {
        contractNumber,
        templateId,
        clientId,
        issuedById: session.user.id,
        projectId: projectId || null,
        variables: JSON.stringify(variables),
        finalContent,
        ...(installments && Array.isArray(installments) && installments.length > 0
          ? {
              installments: {
                create: installments.map(
                  (inst: { title: string; amount: number; percentage?: number; dueAfterDays?: number }, idx: number) => ({
                    title: inst.title,
                    amount: inst.amount,
                    percentage: inst.percentage ?? null,
                    dueAfterDays: inst.dueAfterDays ?? null,
                    order: idx,
                  })
                ),
              },
            }
          : {}),
      },
      include: {
        template: { select: { id: true, title: true } },
        client: { select: { id: true, name: true } },
        issuedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        installments: { orderBy: { order: "asc" } },
      },
    });

    createAuditLog({
      userId: session.user.id,
      userName: session.user.name || undefined,
      userRole: session.user.role,
      action: "CONTRACT_CREATED",
      module: AuditModule.CONTRACTS,
      entityType: "Contract",
      entityId: contract.id,
      entityName: contract.template?.title || `عقد #${contract.contractNumber}`,
      after: { contractNumber: contract.contractNumber, clientId, templateId },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Contract creation error:", error);
    return NextResponse.json(
      { error: "فشل إنشاء العقد", details: String(error) },
      { status: 500 }
    );
  }
}
