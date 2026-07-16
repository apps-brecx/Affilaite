// lib/phone.ts — phone number normalization + verification helpers (server-side).
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { phoneVerifications } from "@/db/schema";
import { getSetting } from "@/lib/queries";

export const RESEND_COOLDOWN_MS = 60 * 1000; // a new code can only be requested every 60s
const VERIFIED_WINDOW_MS = 30 * 60 * 1000; // signup must finish within 30 min of verifying

/** Loose E.164-ish normalization: keep a leading +, strip formatting, sanity-check length. */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.trim().replace(/[^\d+]/g, "");
  const plain = digits.replace(/\D/g, "");
  if (plain.length < 8 || plain.length > 15) return null;
  return digits.startsWith("+") ? `+${plain}` : plain;
}

/** Is phone verification required at signup? Admin-toggleable, default ON. */
export async function phoneVerificationRequired(): Promise<boolean> {
  const v = await getSetting("require_phone_verification", "true");
  return v !== "false" && v !== "0" && v !== "";
}

/** Server-side gate: was this phone verified (code confirmed) recently? */
export async function isPhoneRecentlyVerified(phone: string, withinMs = VERIFIED_WINDOW_MS): Promise<boolean> {
  if (!db) return false;
  const norm = normalizePhone(phone);
  if (!norm) return false;
  const row = await db.query.phoneVerifications.findFirst({
    where: and(eq(phoneVerifications.phone, norm), isNotNull(phoneVerifications.usedAt)),
    orderBy: [desc(phoneVerifications.usedAt)],
  });
  return Boolean(row?.usedAt && Date.now() - new Date(row.usedAt).getTime() < withinMs);
}
