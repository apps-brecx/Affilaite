"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { approvedAffiliateId } from "@/lib/session";
import { getFolpDefault } from "@/lib/folp-server";
import { sanitizeOverrides } from "@/lib/folp";

export type ActionResult = { ok: boolean; message: string };

/** Save the affiliate's OWN landing-page overrides. Locked fields are dropped. */
export async function saveMyFolp(overrides: unknown): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const affiliateId = await approvedAffiliateId();
  if (!affiliateId) return { ok: false, message: "Your account isn't active." };
  const brand = await getFolpDefault();
  const clean = sanitizeOverrides(overrides ?? {}, brand);
  await db.update(affiliates).set({ folpTheme: clean as any }).where(eq(affiliates.id, affiliateId));
  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  if (aff?.handle) revalidatePath(`/p/${aff.handle}`);
  revalidatePath("/landing-page");
  return { ok: true, message: "Your page is saved." };
}

/** Revert to the brand default (clears the affiliate's overrides). */
export async function resetMyFolp(): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const affiliateId = await approvedAffiliateId();
  if (!affiliateId) return { ok: false, message: "Your account isn't active." };
  await db.update(affiliates).set({ folpTheme: null }).where(eq(affiliates.id, affiliateId));
  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  if (aff?.handle) revalidatePath(`/p/${aff.handle}`);
  revalidatePath("/landing-page");
  return { ok: true, message: "Reverted to the brand default." };
}
