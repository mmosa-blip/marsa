import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      select: { id: true, clientId: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    const role = session.user.role;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);
    if (!isAdmin && contract.clientId !== session.user.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const addenda = await prisma.contractAddendum.findMany({
      where: { contractId: id },
      orderBy: { order: "asc" },
      include: {
        createdBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(addenda);
  } catch (error) {
    console.error("Error fetching addenda:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const role = session.user.role;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);
    if (!isAdmin) {
      return NextResponse.json({ error: "غير مصرح بإضافة ملحق" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { title, content, reason } = body;

    if (!title || !content) {
      return NextResponse.json({ error: "العنوان والمحتوى مطلوبان" }, { status: 400 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, status: true, clientId: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "العقد غير موجود" }, { status: 404 });
    }

    // Only allow addenda on signed/active contracts
    if (!["SIGNED", "ACTIVE"].includes(contract.status)) {
      return NextResponse.json(
        { error: "لا يمكن إضافة ملحق إلا على عقد موقّع أو نشط" },
        { status: 400 }
      );
    }

    // Get next order
    const lastAddendum = await prisma.contractAddendum.findFirst({
      where: { contractId: id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const addendum = await prisma.contractAddendum.create({
      data: {
        contractId: id,
        title,
        content,
        reason: reason || null,
        createdById: session.user.id,
        order: (lastAddendum?.order ?? -1) + 1,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Notify client
    await prisma.notification.create({
      data: {
        userId: contract.clientId,
        type: "TASK_UPDATE" as const,
        message: `تم إضافة ملحق جديد للعقد: ${title}`,
        link: `/dashboard/contracts`,
      },
    });

    return NextResponse.json(addendum, { status: 201 });
  } catch (error) {
    console.error("Error creating addendum:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
