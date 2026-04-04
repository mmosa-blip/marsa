import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { can, PERMISSIONS } from "@/lib/permissions";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { isProtectedUser } from "@/lib/protected-users";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.USERS_VIEW))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        isExternal: true,
        createdAt: true,
        updatedAt: true,
        authorizationType: true,
        specialization: true,
        costPerTask: true,
        bankName: true,
        bankIban: true,
        supervisorId: true,
        ownedCompanies: true,
        supervisor: { select: { name: true } },
        supervisedProviders: { select: { name: true, email: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error:", error);
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
    const { id } = await params;
    const isSelf = session.user.id === id;
    const canEdit = isSelf || await can(session.user.id, session.user.role, PERMISSIONS.USERS_EDIT);
    if (!canEdit) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const body = await request.json();

    // Self-edit: restrict to safe fields only
    if (isSelf && !["ADMIN", "MANAGER"].includes(session.user.role)) {
      const allowedKeys = ["name", "phone", "avatar"];
      for (const key of Object.keys(body)) {
        if (!allowedKeys.includes(key)) {
          delete body[key];
        }
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    // Check email uniqueness if changed
    if (body.email && body.email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: body.email },
      });
      if (emailTaken) {
        return NextResponse.json(
          { error: "البريد الإلكتروني مستخدم بالفعل" },
          { status: 400 }
        );
      }
    }

    // Hash password if provided
    if (body.password && body.password.length > 0) {
      body.password = await bcrypt.hash(body.password, 12);
    } else {
      delete body.password;
    }

    // Handle role change to EXTERNAL_PROVIDER
    if (body.role === "EXTERNAL_PROVIDER" && existingUser.role !== "EXTERNAL_PROVIDER") {
      body.isExternal = true;
    }

    // Handle role change from EXTERNAL_PROVIDER
    if (body.role && body.role !== "EXTERNAL_PROVIDER" && existingUser.role === "EXTERNAL_PROVIDER") {
      body.isExternal = false;
      body.specialization = null;
      body.costPerTask = null;
      body.bankName = null;
      body.bankIban = null;
      body.supervisorId = null;
    }

    // Parse costPerTask if provided
    if (body.costPerTask !== undefined && body.costPerTask !== null) {
      body.costPerTask = parseFloat(body.costPerTask);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: body,
    });

    const { password: _, ...userWithoutPassword } = updatedUser;

    createAuditLog({
      userId: session.user.id,
      userName: session.user.name || undefined,
      userRole: session.user.role,
      action: "USER_UPDATED",
      module: AuditModule.USERS,
      entityType: "User",
      entityId: id,
      entityName: updatedUser.name,
      after: body,
    });

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.USERS_DELETE))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const { id } = await params;

    if (session.user.id === id) {
      return NextResponse.json(
        { error: "لا يمكنك حذف حسابك" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { error: "المستخدم غير موجود" },
        { status: 404 }
      );
    }

    // Protect critical accounts from deletion
    if (isProtectedUser(user.email)) {
      return NextResponse.json(
        { error: "لا يمكن حذف هذا الحساب - حساب محمي" },
        { status: 403 }
      );
    }

    // Soft delete only — never hard delete users
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    createAuditLog({
      userId: session.user.id,
      userName: session.user.name || undefined,
      userRole: session.user.role,
      action: "USER_DELETED",
      module: AuditModule.USERS,
      entityType: "User",
      entityId: id,
      entityName: user.name,
    });

    return NextResponse.json({ message: "تم حذف المستخدم بنجاح" });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}
