"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { phoneVerifications } from "@/db/schema";
import { sendVerification, checkVerification } from "@/lib/sms";
import { RESEND_COOLDOWN_MS, normalizePhone } from "@/lib/phone";
import { rateLimit, clientIp } from "@/lib/rate-limit";

type Result = { ok: boolean; message: string; simulated?: boolean };

/** Ask Twilio Verify to text a code. Enforces a 60-second per-number cooldown. */
export async function requestPhoneCode(input: unknown): Promise<Result> {
  if (!db) return { ok: false, message: "Database not configured." };
  try {
    // Cap requests per IP so nobody can rack up Verify charges blasting numbers.
    if (!rateLimit(`sms:${await clientIp()}`, 6, 10 * 60_000).ok) {
      return { ok: false, message: "Too many code requests — please try again shortly." };
    }
    const raw = typeof input === "string" ? input : (input as any)?.phone;
    const phone = normalizePhone(raw);
    if (!phone) return { ok: false, message: "Enter a valid phone number." };

    // 60-second cooldown per number (durable, based on the last request).
    const recent = await db.query.phoneVerifications.findFirst({
      where: eq(phoneVerifications.phone, phone),
      orderBy: [desc(phoneVerifications.createdAt)],
    });
    if (recent?.createdAt && Date.now() - new Date(recent.createdAt).getTime() < RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - new Date(recent.createdAt).getTime())) / 1000);
      return { ok: false, message: `Please wait ${wait}s before requesting another code.` };
    }

    const res = await sendVerification(phone);
    if (!res.simulated && !res.sent) {
      return { ok: false, message: res.error ?? "Couldn't send the code — try again." };
    }

    // Record the request so the cooldown holds and so a later "approved" check can
    // mark this number verified. (Twilio owns the code itself.)
    await db.insert(phoneVerifications).values({
      phone,
      codeHash: "twilio-verify", // vestigial — Verify manages the code
      expiresAt: new Date(Date.now() + 10 * 60_000),
    });

    return {
      ok: true,
      simulated: res.simulated,
      message: res.simulated
        ? "SMS verification isn't connected yet (demo mode) — no code was sent."
        : "We texted you a verification code.",
    };
  } catch (e: any) {
    console.error("[requestPhoneCode]", e);
    return { ok: false, message: "Couldn't send the code right now — please try again." };
  }
}

/** Confirm a code with Twilio Verify, marking the number verified when approved. */
export async function verifyPhoneCode(input: unknown): Promise<Result> {
  if (!db) return { ok: false, message: "Database not configured." };
  try {
    const phone = normalizePhone((input as any)?.phone);
    const code = String((input as any)?.code ?? "").trim();
    if (!phone || !/^\d{4,10}$/.test(code)) return { ok: false, message: "Enter the code we texted you." };

    const res = await checkVerification(phone, code);
    if (!res.approved) return { ok: false, message: res.error ?? "Incorrect or expired code. Try again." };

    // Mark verified: stamp the latest request row (or insert one) so the signup
    // gate (isPhoneRecentlyVerified) can confirm it server-side.
    const row = await db.query.phoneVerifications.findFirst({
      where: eq(phoneVerifications.phone, phone),
      orderBy: [desc(phoneVerifications.createdAt)],
    });
    if (row) {
      await db.update(phoneVerifications).set({ usedAt: new Date() }).where(eq(phoneVerifications.id, row.id));
    } else {
      await db.insert(phoneVerifications).values({ phone, codeHash: "twilio-verify", expiresAt: new Date(), usedAt: new Date() });
    }
    return { ok: true, message: "Phone verified." };
  } catch (e: any) {
    console.error("[verifyPhoneCode]", e);
    return { ok: false, message: "Couldn't verify the code right now — please try again." };
  }
}
