"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { dispatchEmail } from "@/lib/email-center";
import { APP_URL } from "@/lib/links";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type Result = { ok: boolean; message: string };

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/**
 * Start a password reset. Always returns the same message whether or not the
 * email exists (no account enumeration). Sends a one-time link when possible.
 */
export async function requestPasswordReset(input: unknown): Promise<Result> {
  const generic = { ok: true, message: "If an account exists for that email, a reset link is on its way." };
  const email = typeof input === "string" ? input : (input as any)?.email;
  if (!db || typeof email !== "string" || !email.includes("@")) return generic;
  // Throttle reset requests per IP; stay silent (generic) to avoid enumeration.
  if (!rateLimit(`reset:${await clientIp()}`, 5, 15 * 60_000).ok) return generic;

  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase().trim()) });
  if (!user) return generic;

  const token = crypto.randomBytes(32).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  const link = `${APP_URL}/reset-password?token=${token}`;
  // Routed through the Notification Center (admin-editable, but always on).
  await dispatchEmail("password_reset", user.email, { name: user.name ?? "there", link });
  return generic;
}

/** Complete a password reset with a valid, unused, unexpired token. */
export async function resetPassword(input: unknown): Promise<Result> {
  if (!db) return { ok: false, message: "Database not configured." };
  const token = (input as any)?.token;
  const password = (input as any)?.password;
  if (typeof token !== "string" || !token) return { ok: false, message: "Invalid or missing reset link." };
  if (typeof password !== "string" || password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }

  const row = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.tokenHash, hashToken(token)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  });
  if (!row) return { ok: false, message: "This reset link is invalid or has expired. Request a new one." };

  await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, row.userId));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
  return { ok: true, message: "Password updated — you can now sign in." };
}
