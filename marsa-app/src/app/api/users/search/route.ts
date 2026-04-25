import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json([], { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") || "";
    const rolesParam = searchParams.get("roles");
    const transferTargets = searchParams.get("transferTargets") === "true";
    const currentUserId = session.user.id;
    const currentRole = session.user.role as string;

    let allowedRoles: string[];

    if (transferTargets) {
      // For task transfers: all staff except CLIENT and self
      allowedRoles = ["ADMIN", "MANAGER", "EXECUTOR", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"];
    } else if (rolesParam) {
      const requestedRoles = rolesParam.split(",").map((r) => r.trim());
      // Intersect with visibility
      const visibility: Record<string, string[]> = {
        ADMIN: ["ADMIN", "MANAGER", "EXECUTOR", "CLIENT", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"],
        MANAGER: ["ADMIN", "MANAGER", "EXECUTOR", "CLIENT", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"],
        FINANCE_MANAGER: ["ADMIN", "MANAGER", "EXECUTOR", "CLIENT", "FINANCE_MANAGER", "TREASURY_MANAGER"],
        TREASURY_MANAGER: ["ADMIN", "MANAGER", "FINANCE_MANAGER", "TREASURY_MANAGER"],
        EXECUTOR: ["ADMIN", "MANAGER", "CLIENT", "EXECUTOR", "EXTERNAL_PROVIDER"],
        EXTERNAL_PROVIDER: ["ADMIN", "MANAGER", "EXECUTOR"],
        CLIENT: ["ADMIN", "MANAGER", "EXECUTOR"],
      };
      const allowed = visibility[currentRole] || ["ADMIN", "MANAGER"];
      allowedRoles = requestedRoles.filter((r) => allowed.includes(r));
    } else {
      // Default visibility by role
      if (currentRole === "ADMIN" || currentRole === "MANAGER") {
        allowedRoles = ["ADMIN", "MANAGER", "EXECUTOR", "EXTERNAL_PROVIDER", "CLIENT", "FINANCE_MANAGER", "TREASURY_MANAGER"];
      } else if (currentRole === "EXECUTOR" || currentRole === "EXTERNAL_PROVIDER") {
        allowedRoles = ["ADMIN", "MANAGER", "EXECUTOR", "EXTERNAL_PROVIDER"];
      } else {
        allowedRoles = ["ADMIN", "MANAGER"];
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      deletedAt: null,
      id: { not: currentUserId },
      role: { in: allowedRoles },
      isActive: true,
    };

    if (q.trim()) {
      where.OR = [
        { name: { contains: q } },
        { phone: { contains: q } },
        { email: { not: null, contains: q } },
        // Company-name match — meaningful for the CLIENT picker; costs
        // nothing extra for other roles since they typically have no
        // owned companies.
        { ownedCompanies: { some: { name: { contains: q } } } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        avatar: true,
        ownedCompanies: { select: { id: true, name: true }, take: 1 },
      },
      orderBy: { name: "asc" },
      take: 20,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
