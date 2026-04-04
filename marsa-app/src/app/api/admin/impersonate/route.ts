import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  }

  const { userId } = await request.json();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });

  const response = NextResponse.json({ success: true, user });
  response.cookies.set("impersonate_user_id", userId, {
    httpOnly: false,
    maxAge: 60 * 60, // 1 hour
    path: "/",
    sameSite: "lax",
  });
  response.cookies.set("impersonate_name", encodeURIComponent(user.name), {
    httpOnly: false,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "lax",
  });
  response.cookies.set("impersonate_admin_id", session.user.id, {
    httpOnly: false,
    maxAge: 60 * 60,
    path: "/",
    sameSite: "lax",
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("impersonate_user_id");
  response.cookies.delete("impersonate_name");
  response.cookies.delete("impersonate_admin_id");
  return response;
}
