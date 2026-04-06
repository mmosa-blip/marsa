import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST — create a standalone contract (uploaded PDF or new contract without template)
// Body: { clientId, startDate, endDate, durationDays?, contractValue?, uploadedFileUrl?, contractNumber?, projectId?, isExisting?: boolean }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();
    const {
      clientId, startDate, endDate, durationDays,
      contractValue, uploadedFileUrl, contractNumber, projectId,
    } = body;

    if (!clientId) return NextResponse.json({ error: "العميل مطلوب" }, { status: 400 });
    if (!startDate || !endDate) return NextResponse.json({ error: "تواريخ العقد مطلوبة" }, { status: 400 });

    const start = new Date(startDate);
    const end = new Date(endDate);
    const computedDuration = durationDays
      ? parseInt(String(durationDays))
      : Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const contract = await prisma.contract.create({
      data: {
        clientId,
        issuedById: session.user.id,
        projectId: projectId || null,
        templateId: null,
        variables: "{}",
        finalContent: "",
        status: "DRAFT",
        startDate: start,
        endDate: end,
        durationDays: computedDuration,
        contractValue: contractValue != null ? parseFloat(String(contractValue)) : null,
        uploadedFileUrl: uploadedFileUrl || null,
        contractNumber: contractNumber ? parseInt(String(contractNumber)) : null,
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    const msg = error instanceof Error ? error.message : "حدث خطأ";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
