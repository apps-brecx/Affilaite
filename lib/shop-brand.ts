// lib/shop-brand.ts — the STORE's own brand (name + logo) pulled from Shopify.
// Used ONLY on the friend-offer landing page, where we're promoting Syruvia (the
// store), not Sipfluence (the affiliate platform). Cached in appSettings so we
// don't hit Shopify on every render.
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { shopifyGraphQL } from "./shopify";
import { shopifyReady } from "./integrations";

export interface ShopBrand {
  name: string;
  logo: string | null;      // for light backgrounds
  logoDark: string | null;  // for dark backgrounds (falls back to logo)
}

const KEY = "shop_brand";
const TTL = 24 * 60 * 60 * 1000; // refresh daily

export async function getShopBrand(): Promise<ShopBrand> {
  const empty: ShopBrand = { name: "", logo: null, logoDark: null };
  if (db) {
    const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, KEY) });
    if (row?.value) {
      try {
        const c = JSON.parse(row.value);
        if (c.fetchedAt && Date.now() - c.fetchedAt < TTL) return { name: c.name ?? "", logo: c.logo ?? null, logoDark: c.logoDark ?? c.logo ?? null };
      } catch {}
    }
  }
  if (!(await shopifyReady())) return empty;
  try {
    // Shopify brand assets: a primary logo + optional square logo. There's no
    // separate dark-mode logo in the Admin API, so we use the square logo as the
    // dark variant when present, else the same logo.
    const j: any = await shopifyGraphQL(
      `{ shop { name brand { logo { image { url } } squareLogo { image { url } } } } }`,
    );
    const shop = j?.data?.shop;
    const logo = shop?.brand?.logo?.image?.url ?? null;
    const square = shop?.brand?.squareLogo?.image?.url ?? null;
    const brand: ShopBrand = { name: shop?.name ?? "", logo, logoDark: square ?? logo };
    if (db) {
      const value = JSON.stringify({ ...brand, fetchedAt: Date.now() });
      await db
        .insert(appSettings)
        .values({ key: KEY, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
    }
    return brand;
  } catch {
    return empty;
  }
}
