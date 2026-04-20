import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Global auth gate. Previously every /api route had to call
// getServerSession manually — a handful slipped through unprotected
// (/api/hr/companies GET, /api/admin/stop-impersonate, etc.). This
// middleware fails-closed: any request that isn't on the public
// allow-list must carry a valid next-auth session cookie, or the
// request is rejected before it reaches the route handler.
export default withAuth(
  function middleware() {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;

        // Public endpoints. Keep this list short and review it when
        // adding new routes — anything here is reachable without a
        // session.
        const publicPaths = [
          "/api/auth",         // next-auth callbacks (sign-in, callback, etc.)
          "/api/uploadthing",  // uploadthing has its own auth layer
          "/api/cron",         // Vercel Cron hits these with a CRON_SECRET header
          "/login",
          "/register",
        ];

        if (publicPaths.some((p) => path.startsWith(p))) {
          return true;
        }

        // Everything else (both /api/* and page routes) requires a session.
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
