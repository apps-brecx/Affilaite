import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB / bcrypt) — shared by middleware and the full auth.ts.
// Route gating lives in middleware.ts so it can issue friendly redirects.
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
        token.isOwner = (user as any).isOwner ?? false;
        token.permissions = (user as any).permissions ?? null;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role ?? "affiliate";
        (session.user as any).affiliateId = token.affiliateId ?? null;
        (session.user as any).isOwner = token.isOwner ?? false;
        (session.user as any).permissions = (token.permissions as string[] | null) ?? null;
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
