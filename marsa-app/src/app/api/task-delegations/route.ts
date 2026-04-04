import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const delegations = await prisma.taskTransferDelegation.findMany({
      include: {
        fromProvider: {
          select: { id: true, name: true, email: true },
        },
        toProvider: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(delegations);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")
    ) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { fromProviderId, toProviderId, isPermanent } = await request.json();

    if (!fromProviderId || !toProviderId) {
      return NextResponse.json(
        { error: "المزود المصدر والمزود المستهدف مطلوبان" },
        { status: 400 }
      );
    }

    if (fromProviderId === toProviderId) {
      return NextResponse.json(
        { error: "لا يمكن إنشاء تفويض لنفس المزود" },
        { status: 400 }
      );
    }

    // Check if delegation already exists
    const existing = await prisma.taskTransferDelegation.findUnique({
      where: {
        fromProviderId_toProviderId: {
          fromProviderId,
          toProviderId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "التفويض موجود بالفعل" },
        { status: 400 }
      );
    }

    const delegation = await prisma.taskTransferDelegation.create({
      data: {
        fromProviderId,
        toProviderId,
        isPermanent: isPermanent ?? false,
      },
      include: {
        fromProvider: {
          select: { id: true, name: true, email: true },
        },
        toProvider: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json(delegation, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
