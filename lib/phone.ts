// lib/phone.ts — phone number normalization + verification helpers (server-side).
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { phoneVerifications } from "@/db/schema";
import { getSetting } from "@/lib/queries";

export const RESEND_COOLDOWN_MS = 60 * 1000; // a new code can only be requested every 60s
const VERIFIED_WINDOW_MS = 30 * 60 * 1000; // signup must finish within 30 min of verifying

/**
 * Loose E.164-ish normalization. So partners never have to type a country code,
 * a bare 10-digit number is assumed North American (+1), and 11 digits starting
 * with 1 gets a +. A number typed WITH a leading + keeps its own country code.
 */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const hasPlus = raw.trim().startsWith("+");
  const plain = raw.replace(/\D/g, "");
  if (hasPlus) {
    if (plain.length < 8 || plain.length > 15) return null;
    return `+${plain}`;
  }
  if (plain.length === 10) return `+1${plain}`; // US/Canada, no country code typed
  if (plain.length === 11 && plain.startsWith("1")) return `+${plain}`;
  if (plain.length < 8 || plain.length > 15) return null;
  return `+${plain}`;
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
