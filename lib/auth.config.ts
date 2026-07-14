import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB / bcrypt) — shared by middleware and the full auth.ts.
const AFFILIATE_PREFIXES = ["/dashboard", "/links", "/performance", "/payouts", "/assets", "/settings"];

export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real providers added in lib/auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role ?? "affiliate";
        token.affiliateId = (user as any).affiliateId ?? null;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role ?? "affiliate";
        (session.user as any).affiliateId = token.affiliateId ?? null;
        (session.user as any).id = token.sub;
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = (auth?.user as any)?.role;
      const isLoggedIn = Boolean(auth?.user);

      if (pathname.startsWith("/admin")) return role === "admin";
      if (AFFILIATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
        return isLoggedIn;
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
