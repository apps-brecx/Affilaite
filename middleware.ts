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

  // Temp-code users must set a real password before they can use the portal.
  // Send them to /set-password on every protected route until the flag clears.
  if (isLoggedIn && user?.mustChangePassword && path !== "/set-password") {
    return NextResponse.redirect(new URL("/set-password", nextUrl));
  }
  // Once the flag is cleared, don't leave them stranded on /set-password.
  if (path === "/set-password" && isLoggedIn && !user?.mustChangePassword) {
    const home = user?.role === "admin" ? "/admin" : "/dashboard";
    return NextResponse.redirect(new URL(home, nextUrl));
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
    "/set-password",
    "/admin/:path*",
    "/dashboard/:path*",
    "/links/:path*",
    "/performance/:path*",
    "/payouts/:path*",
    "/assets/:path*",
    "/settings/:path*",
  ],
};
