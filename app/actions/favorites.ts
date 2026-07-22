"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { affiliates, users } from "@/db/schema";
import { approvedAffiliateId } from "@/lib/session";
import { shopifyReady } from "@/lib/integrations";
import { syncFavorites, collectionUrl } from "@/lib/favorites";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type FavResult = { ok: boolean; message: string; collectionUrl?: string | null };

/** Save the affiliate's "Shop my Favorites" picks — reconciles their Shopify collection. */
export async function saveMyFavorites(productIds: unknown): Promise<FavResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const affiliateId = await approvedAffiliateId();
  if (!affiliateId) return { ok: false, message: "Your account isn't active." };
  if (!(await shopifyReady())) return { ok: false, message: "Connect your Shopify store first to build a favorites collection." };
  if (!rateLimit(`favorites:${await clientIp()}`, 10, 60_000).ok) {
    return { ok: false, message: "Too many changes — please wait a moment and try again." };
  }
  const ids = Array.isArray(productIds) ? productIds.filter((p): p is string => typeof p === "string") : [];

  const row = await db
    .select({ aff: affiliates, name: users.name })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(affiliates.id, affiliateId))
    .limit(1);
  const a = row[0];
  if (!a) return { ok: false, message: "Affiliate not found." };

  try {
    const { handle } = await syncFavorites(
      {
        id: a.aff.id,
        name: a.name ?? "My",
        refCode: a.aff.refCode,
        favoriteCollectionId: a.aff.favoriteCollectionId ?? null,
        favoriteCollectionHandle: a.aff.favoriteCollectionHandle ?? null,
        favoriteProductIds: (a.aff.favoriteProductIds as string[]) ?? null,
      },
      ids,
    );
    if (a.aff.handle) revalidatePath(`/p/${a.aff.handle}`);
    revalidatePath("/landing-page");
    return { ok: true, message: `Saved ${ids.length} favorite${ids.length === 1 ? "" : "s"}.`, collectionUrl: await collectionUrl(handle) };
  } catch (e: any) {
    console.error("[saveMyFavorites]", e);
    return { ok: false, message: e?.message ? `Couldn't sync to Shopify: ${e.message}` : "Couldn't sync your favorites to Shopify." };
  }
}
