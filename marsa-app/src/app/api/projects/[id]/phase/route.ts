import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PHASE_ORDER = ["CONTRACT", "PAYMENTS", "CONTRACT_APPROVAL", "SERVICES", "PROVIDERS", "MANAGER", "EXECUTION", "COMPLETED"];

// PATCH — advance or set project phase
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
    const { phase, action } = await request.json();

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        paymentSchedule: true,
        services: { orderBy: { serviceOrder: "asc" } },
      },
    });

    if (!project) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 });

    let targetPhase = phase;

    // If action is "next", advance to next phase
    if (action === "next") {
      const currentIdx = PHASE_ORDER.indexOf(project.phase);
      if (currentIdx >= PHASE_ORDER.length - 1) {
        return NextResponse.json({ error: "المشروع في المرحلة الأخيرة" }, { status: 400 });
      }
      targetPhase = PHASE_ORDER[currentIdx + 1];
    }

    if (!PHASE_ORDER.includes(targetPhase)) {
      return NextResponse.json({ error: "مرحلة غير صالحة" }, { status: 400 });
    }

    // Gate checks
    const targetIdx = PHASE_ORDER.indexOf(targetPhase);
    const currentIdx = PHASE_ORDER.indexOf(project.phase);

    // Cannot skip phases (can only go forward by 1)
    if (targetIdx > currentIdx + 1) {
      return NextResponse.json({ error: "لا يمكن تخطي المراحل" }, { status: 400 });
    }

    // Gate: CONTRACT_APPROVAL requires contract dates and total price
    if (targetPhase === "CONTRACT_APPROVAL" && !project.contractStartDate) {
      return NextResponse.json({ error: "يجب تحديد تواريخ العقد أولاً" }, { status: 400 });
    }

    // Gate: SERVICES requires at least one payment in schedule (if phase was PAYMENTS)
    if (targetPhase === "SERVICES" && project.paymentSchedule.length === 0) {
      // Allow skipping payments if totalPrice is 0
      if (project.totalPrice && project.totalPrice > 0) {
        return NextResponse.json({ error: "يجب إضافة جدول الدفعات أولاً" }, { status: 400 });
      }
    }

    // Gate: EXECUTION requires at least one service
    if (targetPhase === "EXECUTION" && project.services.length === 0) {
      return NextResponse.json({ error: "يجب إضافة خدمة واحدة على الأقل" }, { status: 400 });
    }

    // Update phase and status
    const statusMap: Record<string, string> = {
      CONTRACT: "DRAFT",
      PAYMENTS: "DRAFT",
      CONTRACT_APPROVAL: "DRAFT",
      SERVICES: "DRAFT",
      PROVIDERS: "DRAFT",
      MANAGER: "DRAFT",
      EXECUTION: "ACTIVE",
      COMPLETED: "COMPLETED",
    };

    await prisma.project.update({
      where: { id },
      data: {
        phase: targetPhase as "CONTRACT" | "PAYMENTS" | "CONTRACT_APPROVAL" | "SERVICES" | "PROVIDERS" | "MANAGER" | "EXECUTION" | "COMPLETED",
        status: (statusMap[targetPhase] || "ACTIVE") as "DRAFT" | "ACTIVE" | "COMPLETED",
      },
    });

    return NextResponse.json({ phase: targetPhase, success: true });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
