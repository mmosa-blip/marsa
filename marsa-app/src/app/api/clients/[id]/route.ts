import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    const client = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true, createdAt: true,
        authorizationType: true, authorizationGrantedAt: true,
        ownedCompanies: { select: { id: true, name: true, commercialRegister: true, sector: true } },
        clientProjects: {
          include: {
            tasks: { select: { id: true, status: true } },
            invoices: { select: { id: true, totalAmount: true, status: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        clientServices: {
          select: { id: true, name: true, category: true, price: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        clientInvoices: {
          include: { payments: { select: { amount: true } } },
          orderBy: { createdAt: "desc" },
        },
        clientReminders: {
          include: { company: { select: { name: true } } },
          orderBy: { dueDate: "asc" },
        },
        documents: {
          include: { company: { select: { name: true } } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "العميل غير موجود" }, { status: 404 });
    }

    const totalProjects = client.clientProjects.length;
    const activeProjects = client.clientProjects.filter((p) => p.status === "ACTIVE").length;
    const totalServices = client.clientServices.length;
    const totalTasks = client.clientProjects.reduce((s, p) => s + p.tasks.length, 0);
    const completedTasks = client.clientProjects.reduce(
      (s, p) => s + p.tasks.filter((t) => t.status === "DONE").length, 0
    );

    const projectInvoiceTotals = client.clientProjects.flatMap((p) => p.invoices).reduce((s, inv) => s + inv.totalAmount, 0);
    const directInvoiceTotals = client.clientInvoices.reduce((s, inv) => s + inv.totalAmount, 0);
    const totalRevenue = projectInvoiceTotals + directInvoiceTotals;
    const totalPaid = client.clientInvoices.reduce(
      (s, inv) => s + inv.payments.reduce((ps, p) => ps + p.amount, 0), 0
    );

    // إحصائيات الوثائق
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const totalDocuments = client.documents.length;
    const validDocs = client.documents.filter((d) => !d.expiryDate || new Date(d.expiryDate) > thirtyDays).length;
    const expiringDocs = client.documents.filter((d) => d.expiryDate && new Date(d.expiryDate) >= now && new Date(d.expiryDate) <= thirtyDays).length;
    const expiredDocs = client.documents.filter((d) => d.expiryDate && new Date(d.expiryDate) < now).length;

    return NextResponse.json({
      ...client,
      stats: {
        totalProjects, activeProjects, totalServices, totalTasks, completedTasks,
        totalRevenue, totalPaid,
        totalReminders: client.clientReminders.length,
        totalDocuments, validDocs, expiringDocs, expiredDocs,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["ADMIN", "MANAGER"].includes(session.user.role)) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const { id } = await params;

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ message: "تم حذف العميل" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
