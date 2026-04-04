import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.redirect("https://marsa-app-livid.vercel.app/dashboard");
  response.cookies.set("impersonate_user_id", "", { maxAge: 0, path: "/" });
  response.cookies.set("impersonate_admin_id", "", { maxAge: 0, path: "/" });
  return response;
}
