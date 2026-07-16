"use server";

import crypto from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { phoneVerifications } from "@/db/schema";
import { sendSms } from "@/lib/sms";
import { CODE_TTL_MS, MAX_ATTEMPTS, RESEND_COOLDOWN_MS, hashCode, normalizePhone } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type Result = { ok: boolean; message: string; simulated?: boolean };

/** Send a 6-digit verification code to a phone number. */
export async function requestPhoneCode(input: unknown): Promise<Result> {
  if (!db) return { ok: false, message: "Database not configured." };
  // Cap codes per IP so nobody can rack up SMS costs blasting many numbers.
  if (!rateLimit(`sms:${await clientIp()}`, 6, 10 * 60_000).ok) {
    return { ok: false, message: "Too many code requests — please try again shortly." };
  }
  const raw = typeof input === "string" ? input : (input as any)?.phone;
  const phone = normalizePhone(raw);
  if (!phone) return { ok: false, message: "Enter a valid phone number." };

  // Cooldown so codes can't be spammed to a number.
  const recent = await db.query.phoneVerifications.findFirst({
    where: eq(phoneVerifications.phone, phone),
    orderBy: [desc(phoneVerifications.createdAt)],
  });
  if (recent?.createdAt && Date.now() - new Date(recent.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    return { ok: false, message: "Please wait a moment before requesting another code." };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(phoneVerifications).values({
    phone,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  const res = await sendSms(phone, `Your Sipfluence verification code is ${code}. It expires in 10 minutes.`);
  return {
    ok: true,
    simulated: res.simulated,
    message: res.simulated
      ? "SMS isn't connected yet — the code was written to the server log (demo mode)."
      : "We texted you a 6-digit code.",
  };
}

/** Confirm a code for a phone number, marking it verified. */
export async function verifyPhoneCode(input: unknown): Promise<Result> {
  if (!db) return { ok: false, message: "Database not configured." };
  const phone = normalizePhone((input as any)?.phone);
  const code = (input as any)?.code;
  if (!phone || typeof code !== "string" || !/^\d{6}$/.test(code)) {
    return { ok: false, message: "Enter the 6-digit code." };
  }

  const row = await db.query.phoneVerifications.findFirst({
    where: and(
      eq(phoneVerifications.phone, phone),
      isNull(phoneVerifications.usedAt),
      gt(phoneVerifications.expiresAt, new Date()),
    ),
    orderBy: [desc(phoneVerifications.createdAt)],
  });
  if (!row) return { ok: false, message: "That code has expired — request a new one." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, message: "Too many attempts. Request a new code." };

  if (row.codeHash !== hashCode(code)) {
    await db.update(phoneVerifications).set({ attempts: row.attempts + 1 }).where(eq(phoneVerifications.id, row.id));
    return { ok: false, message: "Incorrect code. Try again." };
  }

  await db.update(phoneVerifications).set({ usedAt: new Date() }).where(eq(phoneVerifications.id, row.id));
  return { ok: true, message: "Phone verified." };
}
