import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { canAccessPath } from "@/lib/permissions";

const { auth } = NextAuth(authConfig);

const AFFILIATE_PREFIXES = ["/dashboard", "/links", "/performance", "/payouts", "/assets", "/settings"];

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const user = (req.auth?.user as any) ?? null;
  const isLoggedIn = !!user;

  const needsAuth = path.startsWith("/admin") || AFFILIATE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
  if (needsAuth && !isLoggedIn) {
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(path)}`, nextUrl));
  }

  if (path.startsWith("/admin")) {
    if (user?.role !== "admin") return NextResponse.redirect(new URL("/dashboard", nextUrl));
    // Owner passes everything; team members are gated per area — bounce to the
    // dashboard (which every admin can see) rather than a dead end.
    if (!canAccessPath(user, path)) return NextResponse.redirect(new URL("/admin", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/links/:path*",
    "/performance/:path*",
    "/payouts/:path*",
    "/assets/:path*",
    "/settings/:path*",
  ],
};
