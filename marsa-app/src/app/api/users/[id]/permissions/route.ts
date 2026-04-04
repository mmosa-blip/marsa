import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { can, PERMISSIONS } from "@/lib/permissions";

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

    // Allow user to view their own, or check permission
    if (session.user.id !== id && !(await can(session.user.id, session.user.role, PERMISSIONS.USERS_PERMISSIONS))) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const userPerms = await prisma.userPermission.findMany({
      where: { userId: id },
      include: {
        permission: true,
        grantedBy: { select: { name: true } },
      },
    });

    const permissionKeys = userPerms.map((up) => up.permission.key);

    return NextResponse.json({ permissionKeys, details: userPerms });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.USERS_PERMISSIONS))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { id } = await params;
    const { permissionKeys } = (await request.json()) as { permissionKeys: string[] };

    if (!Array.isArray(permissionKeys)) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    // Resolve permission IDs from keys
    const permissions = await prisma.permission.findMany({
      where: { key: { in: permissionKeys } },
    });

    const permissionIds = permissions.map((p) => p.id);

    // Full replace: delete all existing, create new
    await prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId: id } });

      if (permissionIds.length > 0) {
        await tx.userPermission.createMany({
          data: permissionIds.map((permissionId) => ({
            userId: id,
            permissionId,
            grantedById: session.user.id,
          })),
        });
      }
    });

    // Return updated list
    const updated = await prisma.userPermission.findMany({
      where: { userId: id },
      include: { permission: true },
    });

    createAuditLog({
      userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
      action: "PERMISSIONS_UPDATED", module: AuditModule.USERS,
      severity: "WARN",
      entityType: "User", entityId: id,
      after: { permissionKeys },
    });

    return NextResponse.json({
      permissionKeys: updated.map((up) => up.permission.key),
    });
  } catch (error) {
    console.error("Error updating user permissions:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.USERS_PERMISSIONS))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { id } = await params;
    const { permissionKey, action, expiresAt } = (await request.json()) as {
      permissionKey: string;
      action: "grant" | "revoke";
      expiresAt?: string;
    };

    const permission = await prisma.permission.findUnique({
      where: { key: permissionKey },
    });

    if (!permission) {
      return NextResponse.json({ error: "الصلاحية غير موجودة" }, { status: 404 });
    }

    if (action === "revoke") {
      await prisma.userPermission.deleteMany({
        where: { userId: id, permissionId: permission.id },
      });
    } else {
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: id, permissionId: permission.id } },
        update: {
          grantedById: session.user.id,
          grantedAt: new Date(),
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
        create: {
          userId: id,
          permissionId: permission.id,
          grantedById: session.user.id,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
        },
      });
    }

    const updated = await prisma.userPermission.findMany({
      where: { userId: id },
      include: { permission: true },
    });

    createAuditLog({
      userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
      action: action === "grant" ? "PERMISSION_GRANTED" : "PERMISSION_REVOKED",
      module: AuditModule.USERS,
      severity: "WARN",
      entityType: "User", entityId: id,
      after: { permissionKey, action },
    });

    return NextResponse.json({
      permissionKeys: updated.map((up) => up.permission.key),
    });
  } catch (error) {
    console.error("Error patching user permissions:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
