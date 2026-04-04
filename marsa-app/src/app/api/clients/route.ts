import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, PERMISSIONS, getUserPermissions } from "@/lib/permissions";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const role = session.user.role;
    const userId = session.user.id;
    const isAdmin = ["ADMIN", "MANAGER"].includes(role);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { role: "CLIENT", deletedAt: null };

    // Executor: only see clients linked to their projects/contracts
    if (!isAdmin && role !== "CLIENT") {
      const perms = await getUserPermissions(userId);
      if (!perms.includes("clients.view")) {
        where.OR = [
          { clientProjects: { some: { tasks: { some: { assigneeId: userId } } } } },
          { clientContracts: { some: { issuedById: userId } } },
        ];
      }
    }

    if (search) {
      if (where.OR) {
        const executorConditions = where.OR;
        delete where.OR;
        where.AND = [
          { OR: executorConditions },
          { OR: [{ name: { contains: search } }, { email: { contains: search } }] },
        ];
      } else {
        where.OR = [
          { name: { contains: search } },
          { email: { contains: search } },
        ];
      }
    }

    const clients = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        createdAt: true,
        authorizationType: true,
        ownedCompanies: { select: { id: true, name: true } },
        clientProjects: {
          select: {
            id: true, status: true,
            invoices: { select: { totalAmount: true } },
          },
        },
        clientServices: {
          select: { id: true, status: true },
        },
        clientInvoices: { select: { totalAmount: true } },
        documents: {
          select: { id: true, status: true, expiryDate: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const result = clients.map((c) => {
      const projectCount = c.clientProjects.length;
      const activeProjects = c.clientProjects.filter((p) => p.status === "ACTIVE").length;
      const serviceCount = c.clientServices.length;

      const projectInvoiceAmounts = c.clientProjects.flatMap((p) => p.invoices.map((inv) => inv.totalAmount));
      const directInvoiceAmounts = c.clientInvoices.map((inv) => inv.totalAmount);
      const totalRevenue = [...projectInvoiceAmounts, ...directInvoiceAmounts].reduce((s, a) => s + a, 0);

      const isActive = activeProjects > 0 || c.clientServices.some((s) => s.status === "IN_PROGRESS");

      // حساب حالة الوثائق
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expiredDocs = c.documents.filter((d) => d.expiryDate && new Date(d.expiryDate) < now).length;
      const expiringDocs = c.documents.filter((d) => d.expiryDate && new Date(d.expiryDate) >= now && new Date(d.expiryDate) <= thirtyDaysFromNow).length;

      return {
        id: c.id, name: c.name, email: c.email, phone: c.phone,
        avatar: c.avatar, createdAt: c.createdAt,
        authorizationType: c.authorizationType,
        companyName: c.ownedCompanies[0]?.name || null,
        companyId: c.ownedCompanies[0]?.id || null,
        projectCount, activeProjects, serviceCount, totalRevenue, isActive,
        totalDocuments: c.documents.length,
        expiredDocs, expiringDocs,
      };
    });

    const filtered = status === "active" ? result.filter((c) => c.isActive)
      : status === "inactive" ? result.filter((c) => !c.isActive) : result;

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
