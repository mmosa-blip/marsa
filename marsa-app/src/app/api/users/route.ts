import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createUserSchema, normalizePhone, isValidPhone } from "@/lib/validations";
import { createAuditLog, AuditModule } from "@/lib/audit";
import { can, PERMISSIONS, assignDefaultPermissions } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const transferTargets = searchParams.get("transferTargets") === "true";

    // Transfer targets bypass: all staff except CLIENT — no permission required
    if (transferTargets) {
      const users = await prisma.user.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          id: { not: session.user.id },
          role: { in: ["ADMIN", "MANAGER", "EXECUTOR", "BRANCH_MANAGER", "EXTERNAL_PROVIDER", "FINANCE_MANAGER", "TREASURY_MANAGER"] },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
        },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(users);
    }

    // Permission check for normal user listing
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.USERS_VIEW))) {
      return NextResponse.json({ error: "ليس لديك صلاحية" }, { status: 403 });
    }

    const role = searchParams.get("role");
    const excludeRole = searchParams.get("excludeRole");
    const search = searchParams.get("search");
    const isActive = searchParams.get("isActive");

    // Always exclude soft-deleted rows. Without this, users that have been
    // deleted via DELETE /api/users/[id] (which sets deletedAt + isActive=false)
    // would still appear in the listing — the user-preview page would look
    // like the delete button did nothing because the same row keeps coming
    // back on every reload.
    const where: Record<string, unknown> = { deletedAt: null };

    if (role) {
      where.role = role;
    } else if (excludeRole) {
      where.role = { not: excludeRole };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { not: null, contains: search } },
      ];
    }

    if (isActive !== null && isActive !== undefined && isActive !== "") {
      where.isActive = isActive === "true";
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        authorizationType: true,
        ownedCompanies: { select: { name: true } },
        specialization: true,
        isExternal: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
    }

    const body = await request.json();

    // Quick-add client path: ADMIN/MANAGER/EXECUTOR can create CLIENTs with auto-generated password
    if (body.quickAdd && body.role === "CLIENT") {
      if (!(await can(session.user.id, session.user.role, PERMISSIONS.CLIENTS_CREATE))) {
        return NextResponse.json({ error: "ليس لديك صلاحية لإنشاء عملاء" }, { status: 403 });
      }

      const { name, company } = body;
      let { phone } = body;
      const email = body.email?.trim() || null;
      if (!name) {
        return NextResponse.json({ error: "اسم العميل مطلوب" }, { status: 400 });
      }
      if (!phone) {
        return NextResponse.json({ error: "رقم الجوال مطلوب" }, { status: 400 });
      }

      // Normalize + validate phone as E.164.
      phone = normalizePhone(phone);
      if (!isValidPhone(phone)) {
        return NextResponse.json(
          { error: "رقم الجوال غير صالح — أدخل رقماً بصيغة دولية يبدأ بـ + ورمز الدولة" },
          { status: 400 }
        );
      }

      const existingUser = await prisma.user.findUnique({ where: { phone } });
      if (existingUser) {
        return NextResponse.json({ error: "رقم الجوال مسجل مسبقاً" }, { status: 400 });
      }

      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      const user = await prisma.user.create({
        data: {
          phone,
          password: hashedPassword,
          name,
          email,
          role: "CLIENT",
        },
      });

      if (company) {
        await prisma.company.create({
          data: { name: company, ownerId: user.id },
        });
      }

      // Clients don't get default permissions — they access their own data only

      createAuditLog({
        userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
        action: "USER_CREATED", module: AuditModule.USERS,
        entityType: "User", entityId: user.id, entityName: user.name,
        after: { role: "CLIENT", quickAdd: true },
      });

      return NextResponse.json({ id: user.id, name: user.name, email: user.email }, { status: 201 });
    }

    // Full user creation: permission check
    if (!(await can(session.user.id, session.user.role, PERMISSIONS.USERS_CREATE))) {
      return NextResponse.json({ error: "ليس لديك صلاحية لإنشاء مستخدمين" }, { status: 403 });
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((e: { message: string }) => e.message).join(", ");
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    let {
      email,
      password,
      name,
      phone,
      role,
      companyName,
      specialization,
      supervisorId,
      supervisorUserId,
      costPerTask,
      bankName,
      bankIban,
    } = parsed.data;

    const authorizationType = body.authorizationType;

    // Normalize + validate phone as E.164.
    phone = normalizePhone(phone);
    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "رقم الجوال غير صالح — أدخل رقماً بصيغة دولية يبدأ بـ + ورمز الدولة" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return NextResponse.json(
        { error: "رقم الجوال مسجل مسبقاً" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        phone,
        password: hashedPassword,
        name,
        email: email || null,
        role: role || "EMPLOYEE",
        ...(authorizationType ? { authorizationType } : {}),
        specialization: specialization || null,
        supervisorId: supervisorId || null,
        supervisorUserId: supervisorUserId || null,
        costPerTask: costPerTask ?? null,
        bankName: bankName || null,
        bankIban: bankIban || null,
        isExternal: role === "EXTERNAL_PROVIDER" ? true : false,
      },
    });

    if (role === "CLIENT" && companyName) {
      await prisma.company.create({
        data: {
          name: companyName,
          ownerId: user.id,
        },
      });
    }

    const { password: _, ...userWithoutPassword } = user;

    // Assign default permissions based on role
    await assignDefaultPermissions(user.id, user.role, session.user.id);

    createAuditLog({
      userId: session.user.id, userName: session.user.name || undefined, userRole: session.user.role,
      action: "USER_CREATED", module: AuditModule.USERS,
      entityType: "User", entityId: user.id, entityName: user.name,
      after: { role: user.role, email: user.email },
    });

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ error: "حدث خطأ", details: String(error) }, { status: 500 });
  }
}
