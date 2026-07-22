// lib/folp-server.ts — server-side reads for the friend-offer landing page theme.
import { db } from "@/db";
import { appSettings, affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { defaultFolp, mergeFolp, type FolpDefault, type FolpTheme } from "./folp";

const KEY = "folp_default";

/** The brand-level default theme (+ locked fields), falling back to code default. */
export async function getFolpDefault(): Promise<FolpDefault> {
  const d = defaultFolp();
  if (!db) return d;
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, KEY) });
  if (!row?.value) return d;
  try {
    const s = JSON.parse(row.value);
    return {
      layout: s.layout ?? d.layout,
      styles: { ...d.styles, ...(s.styles ?? {}) },
      content: { ...d.content, ...(s.content ?? {}) },
      visibility: { ...d.visibility, ...(s.visibility ?? {}) },
      lockedFields: Array.isArray(s.lockedFields) ? s.lockedFields : d.lockedFields,
    };
  } catch {
    return d;
  }
}

export async function writeFolpDefault(value: FolpDefault): Promise<void> {
  if (!db) return;
  const v = JSON.stringify(value);
  await db
    .insert(appSettings)
    .values({ key: KEY, value: v, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: v, updatedAt: new Date() } });
}

/** Brand default merged with one affiliate's saved overrides (locked fields win). */
export async function getMergedFolp(affiliateId: string): Promise<FolpTheme> {
  const brand = await getFolpDefault();
  if (!db) return mergeFolp(brand, null);
  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  return mergeFolp(brand, aff?.folpTheme ?? null);
}
