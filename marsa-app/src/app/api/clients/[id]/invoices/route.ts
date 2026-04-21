import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["ADMIN", "MANAGER"]);
    const { id } = await params;

    // فواتير مرتبطة مباشرة بالعميل + فواتير مشاريع العميل
    const [directInvoices, projectInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: { clientId: id },
        include: {
          company: { select: { name: true } },
          payments: { select: { amount: true } },
          project: { select: { id: true, name: true, projectCode: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.invoice.findMany({
        where: { project: { clientId: id }, clientId: null },
        include: {
          company: { select: { name: true } },
          payments: { select: { amount: true } },
          project: { select: { id: true, name: true, projectCode: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // دمج بدون تكرار
    const allIds = new Set<string>();
    const all = [...directInvoices, ...projectInvoices].filter((inv) => {
      if (allIds.has(inv.id)) return false;
      allIds.add(inv.id);
      return true;
    });

    return NextResponse.json(all);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
