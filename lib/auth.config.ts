import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB / bcrypt) — shared by middleware and the full auth.ts.
// Route gating lives in middleware.ts so it can issue friendly redirects.
export const authConfig = {
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [], // real providers added in lib/auth.ts
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as any).role ?? "affiliate";
        token.affiliateId = (user as any).affiliateId ?? null;
        token.isOwner = (user as any).isOwner ?? false;
        token.permissions = (user as any).permissions ?? null;
        token.name = user.name ?? token.name;
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
      }
      // After the user sets their password, clear the flag on the live token so
      // middleware stops redirecting them to /set-password.
      if (trigger === "update" && (session as any)?.mustChangePassword === false) {
        token.mustChangePassword = false;
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
        (session.user as any).mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
