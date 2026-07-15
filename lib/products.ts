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

// ---------- Collections ----------

export interface StoreCollection {
  id: string;
  title: string;
  handle: string;
  url: string;
  image: string | null;
  productsCount: number;
}

// Query in tiers: the count field's shape varies by API version, so if the
// full query is rejected we step down — keeping images/URLs before dropping to
// the bare minimum — so collections load with as many fields as possible.
const node = (extra: string) => `
  query Collections($first: Int!) {
    collections(first: $first, sortKey: TITLE) {
      edges { node { id title handle ${extra} } }
    }
  }`;
const COLLECTIONS_TIERS = [
  node("onlineStoreUrl image { url } productsCount { count }"),
  node("onlineStoreUrl image { url }"),
  node(""),
];

export async function getStoreCollections(
  limit = 50,
): Promise<{ connected: boolean; collections: StoreCollection[]; error?: string }> {
  if (!(await shopifyReady())) return { connected: false, collections: [] };
  try {
    const { domain } = await shopifyConfig();
    let json: any = null;
    for (const query of COLLECTIONS_TIERS) {
      json = await shopifyGraphQL<any>(query, { first: limit });
      if (!json.errors?.length) break;
      console.warn("[getStoreCollections] query tier failed, stepping down:", json.errors);
    }
    if (json?.errors?.length) {
      console.error("[getStoreCollections] GraphQL errors:", json.errors);
      return { connected: true, collections: [], error: json.errors.map((e: any) => e.message).join(", ") };
    }
    const edges = json.data?.collections?.edges ?? [];
    const collections: StoreCollection[] = edges
      .map((e: any) => e.node)
      .map((n: any) => ({
        id: n.id as string,
        title: n.title as string,
        handle: n.handle as string,
        url: (n.onlineStoreUrl as string) || (domain ? `https://${domain}/collections/${n.handle}` : `/collections/${n.handle}`),
        image: n.image?.url ?? null,
        productsCount: typeof n.productsCount === "object" ? n.productsCount?.count ?? 0 : (n.productsCount ?? 0),
      }));
    return { connected: true, collections };
  } catch (e: any) {
    console.error("[getStoreCollections]", e);
    return { connected: true, collections: [], error: e?.message ?? "Could not reach Shopify" };
  }
}

// ---------- Admin curation (what affiliates see + order), for products and collections ----------

export interface CatalogConfig {
  order: string[]; // ids in the order the admin wants
  hidden: string[]; // ids hidden from affiliates
}

async function readConfig(key: string): Promise<CatalogConfig> {
  if (!db) return { order: [], hidden: [] };
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  if (!row?.value) return { order: [], hidden: [] };
  try {
    const c = JSON.parse(row.value);
    return { order: Array.isArray(c.order) ? c.order : [], hidden: Array.isArray(c.hidden) ? c.hidden : [] };
  } catch {
    return { order: [], hidden: [] };
  }
}

export const getCatalogConfig = () => readConfig("catalog_config");
export const getCollectionConfig = () => readConfig("collection_config");

/** Apply the admin's curation: drop hidden items and sort by the saved order. */
export function applyConfig<T extends { id: string }>(items: T[], config: CatalogConfig): T[] {
  const hidden = new Set(config.hidden);
  const visible = items.filter((p) => !hidden.has(p.id));
  if (!config.order.length) return visible;
  const pos = new Map(config.order.map((id, i) => [id, i] as const));
  return visible
    .slice()
    .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export const applyCatalogConfig = applyConfig;
export const applyCollectionConfig = applyConfig;
