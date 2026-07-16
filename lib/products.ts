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
  query Catalog($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
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
    const products: StoreProduct[] = [];
    let after: string | null = null;
    // Page through with a cursor (250/page, Shopify's max) up to `limit`, so a
    // catalog with >100 products doesn't silently drop items past the first page.
    for (let guard = 0; products.length < limit && guard < 200; guard++) {
      const pageSize = Math.min(250, limit - products.length + 5);
      const json: any = await shopifyGraphQL<any>(PRODUCTS_QUERY, { first: pageSize, after });
      if (json.errors?.length) {
        console.error("[getStoreProducts] GraphQL errors:", json.errors);
        // If we already have some products, return them rather than nothing.
        if (products.length) break;
        return { connected: true, products: [], error: json.errors.map((e: any) => e.message).join(", ") };
      }
      const conn = json.data?.products;
      for (const e of conn?.edges ?? []) {
        const n = e.node;
        if (!n || n.status === "ARCHIVED") continue;
        const price = n.priceRangeV2?.minVariantPrice;
        products.push({
          id: n.id,
          title: n.title,
          handle: n.handle,
          url: (n.onlineStoreUrl as string) || (domain ? `https://${domain}/products/${n.handle}` : `/products/${n.handle}`),
          image: n.featuredImage?.url ?? null,
          price: price?.amount ? Number(price.amount).toFixed(2) : null,
          currency: price?.currencyCode ?? null,
          available: (n.totalInventory ?? 0) > 0 || n.totalInventory == null,
        });
      }
      if (!conn?.pageInfo?.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return { connected: true, products: products.slice(0, limit) };
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
// Allowlist model: nothing is shown to affiliates until the admin explicitly
// enables it. `shown` holds the ids the admin has turned on.

export interface CatalogConfig {
  order: string[]; // ids in the order the admin wants
  shown: string[]; // ids the admin has made visible to affiliates
}

async function readConfig(key: string): Promise<CatalogConfig> {
  if (!db) return { order: [], shown: [] };
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  if (!row?.value) return { order: [], shown: [] };
  try {
    const c = JSON.parse(row.value);
    return { order: Array.isArray(c.order) ? c.order : [], shown: Array.isArray(c.shown) ? c.shown : [] };
  } catch {
    return { order: [], shown: [] };
  }
}

export const getCatalogConfig = () => readConfig("catalog_config");
export const getCollectionConfig = () => readConfig("collection_config");

/** Apply the admin's curation: only show allowlisted items, in the saved order. */
export function applyConfig<T extends { id: string }>(items: T[], config: CatalogConfig): T[] {
  const shown = new Set(config.shown);
  const visible = items.filter((p) => shown.has(p.id));
  if (!config.order.length) return visible;
  const pos = new Map(config.order.map((id, i) => [id, i] as const));
  return visible
    .slice()
    .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

export const applyCatalogConfig = applyConfig;
export const applyCollectionConfig = applyConfig;

// ---------- "New in Shopify" detection (drives the admin notification dot) ----------

// Short-lived cache of catalog ids so the admin sidebar badge doesn't hit
// Shopify on every page load.
let _idCache: { at: number; products: string[]; collections: string[] } | null = null;

export async function getCatalogItemIds(): Promise<{ products: string[]; collections: string[] }> {
  if (_idCache && Date.now() - _idCache.at < 120_000) return _idCache;
  const [p, c] = await Promise.all([getStoreProducts(250), getStoreCollections(250)]);
  _idCache = {
    at: Date.now(),
    products: p.products.map((x) => x.id),
    collections: c.collections.map((x) => x.id),
  };
  return _idCache;
}

async function readIdSet(key: string): Promise<Set<string>> {
  if (!db) return new Set();
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  try {
    const a = JSON.parse(row?.value ?? "[]");
    return new Set(Array.isArray(a) ? a : []);
  } catch {
    return new Set();
  }
}
export const getSeenProducts = () => readIdSet("catalog_seen_products");
export const getSeenCollections = () => readIdSet("catalog_seen_collections");

/** Count of Shopify products/collections the admin hasn't reviewed yet. */
export async function getCatalogNewCounts(): Promise<{ products: number; collections: number; total: number }> {
  if (!(await shopifyReady())) return { products: 0, collections: 0, total: 0 };
  const [ids, seenP, seenC] = await Promise.all([getCatalogItemIds(), getSeenProducts(), getSeenCollections()]);
  const products = ids.products.filter((id) => !seenP.has(id)).length;
  const collections = ids.collections.filter((id) => !seenC.has(id)).length;
  return { products, collections, total: products + collections };
}
