// lib/auth.ts — full Auth.js config with DB-backed credential login.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, affiliates, programs, inviteTemplates } from "@/db/schema";
import { authConfig } from "./auth.config";
import { rateLimit } from "./rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds, req) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        // Throttle brute-force two ways: per-email (targeted), and per-IP across
        // ALL accounts (password-spraying). Denies like a wrong password rather
        // than revealing the limit.
        if (!rateLimit(`login:${email}`, 8, 10 * 60_000).ok) return null;
        const ip = ((req as any)?.headers?.get?.("x-forwarded-for") ?? "").split(",")[0]?.trim() || "unknown";
        if (!rateLimit(`login-ip:${ip}`, 30, 10 * 60_000).ok) return null;

        // Bootstrap admin from env when no DB user exists yet.
        if (!db) {
          if (email === (process.env.ADMIN_EMAIL ?? "").toLowerCase() && password === process.env.ADMIN_PASSWORD) {
            return { id: "admin", email, name: "Administrator", role: "admin", isOwner: true, permissions: null } as any;
          }
          return null;
        }

        let user = await db.query.users.findFirst({ where: eq(users.email, email) });

        // Bootstrap the admin account on first login from env credentials,
        // so a fresh deploy needs no manual seed step.
        if (
          !user &&
          process.env.ADMIN_EMAIL &&
          process.env.ADMIN_PASSWORD &&
          email === process.env.ADMIN_EMAIL.toLowerCase() &&
          password === process.env.ADMIN_PASSWORD
        ) {
          const passwordHash = await bcrypt.hash(password, 10);
          const [created] = await db
            .insert(users)
            .values({ email, name: "Sipfluence Admin", passwordHash, role: "admin", isOwner: true })
            .returning();
          user = created;

          // Ensure a default program exists so approvals & attribution work.
          const hasDefault = await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
          if (!hasDefault) {
            await db.insert(programs).values({
              name: "Sipfluence Core",
              commissionType: "percent",
              commissionValue: "15",
              cookieWindowDays: 30,
              holdDays: 30,
              payoutMinimum: "25",
              isDefault: true,
            });
          }

          // Seed a starter invite template.
          const hasTemplate = await db.query.inviteTemplates.findFirst({});
          if (!hasTemplate) {
            await db.insert(inviteTemplates).values({
              name: "Warm welcome",
              subject: "You're invited to the Sipfluence partner program 🎉",
              body:
                "Hi {{name}},\n\nYou've been invited to join the Sipfluence partner program! Your personal discount code is {{code}} — share it and earn on every sale.\n\nSign in here: {{loginUrl}}\nTemporary password: {{tempPassword}} (change it after your first login)\n\nWelcome aboard!",
              isDefault: true,
            });
          }
        }

        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        let affiliateId: string | null = null;
        if (user.role === "affiliate") {
          const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.userId, user.id) });
          affiliateId = aff?.id ?? null;
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? email,
          role: user.role,
          affiliateId,
          isOwner: !!(user as any).isOwner,
          permissions: ((user as any).permissions as string[] | null) ?? null,
        } as any;
      },
    }),
  ],
});

export const isAdmin = (session: any) => session?.user?.role === "admin";
