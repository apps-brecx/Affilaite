// lib/folp-server.ts — server-side reads for the friend-offer landing page theme.
import { db } from "@/db";
import { appSettings, affiliates, users } from "@/db/schema";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { defaultFolp, mergeFolp, type FolpDefault, type FolpTheme } from "./folp";

export interface FolpCustomization {
  id: string;
  name: string;
  handle: string | null;
  hasCustomTheme: boolean;
  favoriteCount: number;
}

/** Affiliates who've customized their landing page or built a favorites list. */
export async function listFolpCustomizations(): Promise<FolpCustomization[]> {
  if (!db) return [];
  const rows = await db
    .select({ aff: affiliates, name: users.name })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(and(eq(affiliates.status, "approved"), or(isNotNull(affiliates.folpTheme), isNotNull(affiliates.favoriteProductIds))));
  return rows
    .map((r) => {
      const theme = r.aff.folpTheme as Record<string, any> | null;
      const favs = Array.isArray(r.aff.favoriteProductIds) ? r.aff.favoriteProductIds.length : 0;
      return {
        id: r.aff.id,
        name: r.name ?? "Partner",
        handle: r.aff.handle ?? null,
        hasCustomTheme: !!theme && Object.keys(theme).length > 0,
        favoriteCount: favs,
      };
    })
    .filter((c) => c.hasCustomTheme || c.favoriteCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
