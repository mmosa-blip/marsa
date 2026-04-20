import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// GET /api/admin/stop-impersonate
// Clears the impersonation cookies and redirects back to /dashboard.
// Must be called from an authenticated browser session — the middleware
// already rejects anonymous requests, but we also re-check here so a
// forgotten middleware edit can't turn this into an unauthenticated
// cookie-eraser. The redirect uses NEXTAUTH_URL so the host isn't
// pinned to one Vercel deployment.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "NEXTAUTH_URL غير مضبوط في البيئة" },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(`${baseUrl.replace(/\/$/, "")}/dashboard`);
  response.cookies.set("impersonate_user_id", "", { maxAge: 0, path: "/" });
  response.cookies.set("impersonate_admin_id", "", { maxAge: 0, path: "/" });
  return response;
}
