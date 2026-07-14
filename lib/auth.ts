// lib/auth.ts — full Auth.js config with DB-backed credential login.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, affiliates } from "@/db/schema";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        // Bootstrap admin from env when no DB user exists yet.
        if (!db) {
          if (email === (process.env.ADMIN_EMAIL ?? "").toLowerCase() && password === process.env.ADMIN_PASSWORD) {
            return { id: "admin", email, name: "Administrator", role: "admin" } as any;
          }
          return null;
        }

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        let affiliateId: string | null = null;
        if (user.role === "affiliate") {
          const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.userId, user.id) });
          affiliateId = aff?.id ?? null;
        }
        return { id: user.id, email: user.email, name: user.name ?? email, role: user.role, affiliateId } as any;
      },
    }),
  ],
});

export const isAdmin = (session: any) => session?.user?.role === "admin";
