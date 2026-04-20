import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Global auth gate. Unlike next-auth/middleware `withAuth` (which always
// redirects to /login), this splits the response by request type:
//   - /api/*  → 401 JSON so fetch() callers get a machine-readable error
//   - pages   → 302 redirect to /login with callbackUrl preserved
// Public endpoints bypass both. Every route that isn't on the allow-list
// must carry a valid next-auth session cookie, or the request is
// rejected before reaching the route handler.
const publicPaths = [
  "/api/auth",         // next-auth callbacks
  "/api/uploadthing",  // uploadthing has its own auth
  "/api/cron",         // Vercel Cron hits with CRON_SECRET header
  "/login",
  "/register",
  "/forgot-password",
];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  if (publicPaths.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "يجب تسجيل الدخول" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
