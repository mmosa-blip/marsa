import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("البريد الإلكتروني وكلمة المرور مطلوبان");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("بيانات الدخول غير صحيحة");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("بيانات الدخول غير صحيحة");
        }

        // Seed default permissions for existing users with none
        const existingPerms = await prisma.userPermission.count({
          where: { userId: user.id },
        });
        if (existingPerms === 0 && ["EXECUTOR", "EXTERNAL_PROVIDER"].includes(user.role)) {
          const defaultKeys = [
            "tasks.view", "tasks.update_status", "tasks.transfer",
            "projects.view", "clients.view", "tickets.view",
          ];
          const perms = await prisma.permission.findMany({
            where: { key: { in: defaultKeys } },
          });
          if (perms.length > 0) {
            await prisma.userPermission.createMany({
              data: perms.map((p) => ({
                userId: user.id,
                permissionId: p.id,
                grantedById: user.id,
              })),
              skipDuplicates: true,
            });
          }
        }
        if (existingPerms === 0 && user.role === "MANAGER") {
          const mgrKeys = [
            "projects.view", "projects.create", "projects.edit",
            "contracts.view", "contracts.create", "contracts.approve", "contracts.templates",
            "clients.view", "clients.create", "clients.edit",
            "finance.view", "finance.cashier", "finance.installments",
            "tasks.view", "tasks.update_status", "tasks.transfer", "tasks.assign",
            "tickets.view", "tickets.manage", "tickets.assign",
            "reports.view", "reports.time", "reports.financial",
            "users.view", "users.create", "users.edit",
          ];
          const perms = await prisma.permission.findMany({
            where: { key: { in: mgrKeys } },
          });
          if (perms.length > 0) {
            await prisma.userPermission.createMany({
              data: perms.map((p) => ({
                userId: user.id,
                permissionId: p.id,
                grantedById: user.id,
              })),
              skipDuplicates: true,
            });
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as unknown as { role: string }).role;
      }
      // Check impersonation cookie
      if (typeof window === "undefined") {
        const { cookies } = await import("next/headers");
        try {
          const cookieStore = await cookies();
          const impersonateId = cookieStore.get("impersonate_user_id")?.value;
          if (impersonateId && token.role === "ADMIN") {
            const { prisma } = await import("./prisma");
            const impUser = await prisma.user.findUnique({
              where: { id: impersonateId },
              select: { id: true, name: true, email: true, role: true },
            });
            if (impUser) {
              token.impersonateId = impUser.id;
              token.impersonateRole = impUser.role;
              token.impersonateName = impUser.name;
              token.impersonateEmail = impUser.email;
            }
          } else {
            delete token.impersonateId;
          }
        } catch {}
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        // Impersonation support
        if (token.impersonateId) {
          session.user.id = token.impersonateId as string;
          session.user.role = token.impersonateRole as string;
          session.user.name = token.impersonateName as string;
          session.user.email = token.impersonateEmail as string;
          (session.user as unknown as Record<string, unknown>).isImpersonating = true;
        }
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/login",
  },

  session: {
    strategy: "jwt",
  },

  secret: process.env.NEXTAUTH_SECRET,
};
