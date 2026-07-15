// lib/products.ts — read the store's product catalog from Shopify.
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { shopifyGraphQL } from "./shopify";
import { shopifyReady, shopifyConfig } from "./integrations";

export interface StoreProduct {
  id: string;
  title: string;
  handle: string;
  url: string;
  image: string | null;
  price: string | null;
  currency: string | null;
  available: boolean;
}

const PRODUCTS_QUERY = `
  query Catalog($first: Int!) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          handle
          status
          onlineStoreUrl
          totalInventory
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }`;

/**
 * Fetch the live product catalog. Returns `connected: false` when Shopify
 * isn't set up so the UI can show a friendly placeholder instead of an error.
 */
export async function getStoreProducts(
  limit = 24,
): Promise<{ connected: boolean; products: StoreProduct[]; error?: string }> {
  if (!(await shopifyReady())) return { connected: false, products: [] };
  try {
    const { domain } = await shopifyConfig();
    const json = await shopifyGraphQL<any>(PRODUCTS_QUERY, { first: limit });
    const errs = json.errors;
    if (errs?.length) {
      console.error("[getStoreProducts] GraphQL errors:", errs);
      return { connected: true, products: [], error: errs.map((e: any) => e.message).join(", ") };
    }
    const edges = json.data?.products?.edges ?? [];
    const products: StoreProduct[] = edges
      .map((e: any) => e.node)
      .filter((n: any) => n && n.status !== "ARCHIVED")
      .map((n: any) => {
        const price = n.priceRangeV2?.minVariantPrice;
        return {
          id: n.id as string,
          title: n.title as string,
          handle: n.handle as string,
          url: (n.onlineStoreUrl as string) || (domain ? `https://${domain}/products/${n.handle}` : `/products/${n.handle}`),
          image: n.featuredImage?.url ?? null,
          price: price?.amount ? Number(price.amount).toFixed(2) : null,
          currency: price?.currencyCode ?? null,
          available: (n.totalInventory ?? 0) > 0 || n.totalInventory == null,
        };
      });
    return { connected: true, products };
  } catch (e: any) {
    console.error("[getStoreProducts]", e);
    return { connected: true, products: [], error: e?.message ?? "Could not reach Shopify" };
  }
}

// ---------- Admin-curated catalog (what affiliates see, and in which order) ----------

export interface CatalogConfig {
  order: string[]; // product ids in the order the admin wants
  hidden: string[]; // product ids hidden from affiliates
}

export async function getCatalogConfig(): Promise<CatalogConfig> {
  if (!db) return { order: [], hidden: [] };
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "catalog_config") });
  if (!row?.value) return { order: [], hidden: [] };
  try {
    const c = JSON.parse(row.value);
    return { order: Array.isArray(c.order) ? c.order : [], hidden: Array.isArray(c.hidden) ? c.hidden : [] };
  } catch {
    return { order: [], hidden: [] };
  }
}

/** Apply the admin's curation: drop hidden products and sort by the saved order. */
export function applyCatalogConfig(products: StoreProduct[], config: CatalogConfig): StoreProduct[] {
  const hidden = new Set(config.hidden);
  const visible = products.filter((p) => !hidden.has(p.id));
  if (!config.order.length) return visible;
  const pos = new Map(config.order.map((id, i) => [id, i] as const));
  return visible
    .slice()
    .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}
