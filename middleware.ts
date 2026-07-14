import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protect app routes; skip static assets and the auth API.
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
