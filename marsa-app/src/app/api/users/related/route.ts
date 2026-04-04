import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const userId = session.user.id;
    const role = session.user.role;

    let users: { id: string; name: string; email: string | null; role: string }[] = [];

    if (["ADMIN", "MANAGER"].includes(role)) {
      // Admins/Managers see all users except themselves
      users = await prisma.user.findMany({
        where: { id: { not: userId }, deletedAt: null },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    } else if (role === "EXECUTOR") {
      // Executors see: clients from assigned projects + managers + admins
      const assignedProjects = await prisma.project.findMany({
        where: {
          deletedAt: null,
          OR: [
            { managerId: userId },
            { services: { some: { tasks: { some: { assigneeId: userId } } } } },
          ],
        },
        select: {
          clientId: true,
          managerId: true,
        },
      });

      const relatedIds = new Set<string>();
      assignedProjects.forEach((p) => {
        if (p.clientId) relatedIds.add(p.clientId);
        if (p.managerId) relatedIds.add(p.managerId);
      });

      // Also add all admins and managers
      const managersAndAdmins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, deletedAt: null, id: { not: userId } },
        select: { id: true },
      });
      managersAndAdmins.forEach((u) => relatedIds.add(u.id));

      relatedIds.delete(userId);

      if (relatedIds.size > 0) {
        users = await prisma.user.findMany({
          where: { id: { in: Array.from(relatedIds) }, deletedAt: null },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        });
      }
    } else if (role === "CLIENT") {
      // Clients see: managers + executors from their projects
      const myProjects = await prisma.project.findMany({
        where: { clientId: userId, deletedAt: null },
        select: {
          managerId: true,
          services: {
            select: {
              tasks: {
                select: { assigneeId: true },
                where: { assigneeId: { not: null } },
              },
            },
          },
        },
      });

      const relatedIds = new Set<string>();
      myProjects.forEach((p) => {
        if (p.managerId) relatedIds.add(p.managerId);
        p.services.forEach((s: { tasks: { assigneeId: string | null }[] }) => {
          s.tasks.forEach((t: { assigneeId: string | null }) => {
            if (t.assigneeId) relatedIds.add(t.assigneeId);
          });
        });
      });

      // Also add all admins and managers
      const managersAndAdmins = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, deletedAt: null, id: { not: userId } },
        select: { id: true },
      });
      managersAndAdmins.forEach((u) => relatedIds.add(u.id));

      relatedIds.delete(userId);

      if (relatedIds.size > 0) {
        users = await prisma.user.findMany({
          where: { id: { in: Array.from(relatedIds) }, deletedAt: null },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
        });
      }
    } else {
      // Other roles: just admins and managers
      users = await prisma.user.findMany({
        where: {
          role: { in: ["ADMIN", "MANAGER"] },
          deletedAt: null,
          id: { not: userId },
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching related users:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
