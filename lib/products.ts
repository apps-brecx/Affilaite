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
  collectionIds: string[]; // collections this product belongs to
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
          publishedAt
          onlineStoreUrl
          totalInventory
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          collections(first: 25) { pageInfo { hasNextPage endCursor } edges { node { id } } }
        }
      }
    }
  }`;

// Follow-up query for the rare product that belongs to >25 collections: page
// through the tail so a product whose ONLY allowed collection sits past the
// first 25 isn't silently dropped from the affiliate catalog. Kept out of the
// bulk query so normal products (a handful of collections) pay no extra cost.
const PRODUCT_COLLECTIONS_QUERY = `
  query ProductCollections($id: ID!, $after: String) {
    product(id: $id) {
      collections(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id } }
      }
    }
  }`;

async function fetchRemainingCollectionIds(productId: string, after: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = after;
  for (let guard = 0; guard < 20 && cursor; guard++) {
    const json: any = await shopifyGraphQL<any>(PRODUCT_COLLECTIONS_QUERY, { id: productId, after: cursor });
    const conn = json?.data?.product?.collections;
    for (const e of conn?.edges ?? []) if (e.node?.id) ids.push(e.node.id);
    if (!conn?.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }
  return ids;
}

// Short-lived in-memory cache so pages that pull the full catalog (Samples,
// Promotions — all request up to 1000) don't hit Shopify's cost-throttled
// products query on every load. The catalog changes rarely; 60s is plenty.
type ProductsResult = { connected: boolean; products: StoreProduct[]; error?: string };
// The catalog changes rarely, so cache aggressively — most page loads become
// instant, and only the first load after 5 min hits Shopify.
const PRODUCTS_TTL = 5 * 60_000;
const _productsCache = new Map<number, { at: number; data: ProductsResult; refreshing?: boolean }>();

/**
 * Fetch the live product catalog. Returns `connected: false` when Shopify
 * isn't set up so the UI can show a friendly placeholder instead of an error.
 *
 * Stale-while-revalidate: a fresh cache returns instantly; a stale cache also
 * returns instantly while refreshing in the background — so only the very first
 * load ever waits on Shopify.
 */
export async function getStoreProducts(limit = 24): Promise<ProductsResult> {
  const cached = _productsCache.get(limit);
  if (cached) {
    const fresh = Date.now() - cached.at < PRODUCTS_TTL;
    if (!fresh && !cached.refreshing) {
      cached.refreshing = true;
      fetchStoreProducts(limit)
        .then((data) => { if (data.connected && !data.error) _productsCache.set(limit, { at: Date.now(), data }); })
        .catch(() => {})
        .finally(() => { const c = _productsCache.get(limit); if (c) c.refreshing = false; });
    }
    return cached.data; // serve fresh or stale immediately
  }
  const data = await fetchStoreProducts(limit);
  if (data.connected && !data.error) _productsCache.set(limit, { at: Date.now(), data });
  return data;
}

async function fetchStoreProducts(limit: number): Promise<ProductsResult> {
  if (!(await shopifyReady())) return { connected: false, products: [] };
  try {
    const { domain } = await shopifyConfig();
    const products: StoreProduct[] = [];
    let after: string | null = null;
    let partial = false; // a mid-pagination error left the catalog incomplete
    // Page through with a cursor up to `limit`. We use 100/page (not Shopify's
    // 250 max) because the nested collections push the query cost near Shopify's
    // 1000-point ceiling at 250 — smaller pages stay under it and avoid the
    // throttle-and-retry waits that made big catalogs slow to load.
    for (let guard = 0; products.length < limit && guard < 200; guard++) {
      const pageSize = Math.min(100, limit - products.length + 5);
      const json: any = await shopifyGraphQL<any>(PRODUCTS_QUERY, { first: pageSize, after });
      if (json.errors?.length) {
        console.error("[getStoreProducts] GraphQL errors:", json.errors);
        // If we already have some products, return them rather than nothing —
        // but flag the result as partial so it's served this once and NOT cached
        // as if it were the full catalog (which would hide products for 5 min).
        if (products.length) { partial = true; break; }
        return { connected: true, products: [], error: json.errors.map((e: any) => e.message).join(", ") };
      }
      const conn = json.data?.products;
      for (const e of conn?.edges ?? []) {
        const n = e.node;
        // Only surface products that are live on the store — active status AND
        // published to the online store. Drafts/archived never reach affiliates.
        if (!n || n.status !== "ACTIVE" || !n.publishedAt) continue;
        const price = n.priceRangeV2?.minVariantPrice;
        let collectionIds: string[] = (n.collections?.edges ?? []).map((c: any) => c.node?.id).filter(Boolean);
        if (n.collections?.pageInfo?.hasNextPage) {
          try {
            collectionIds = collectionIds.concat(await fetchRemainingCollectionIds(n.id, n.collections.pageInfo.endCursor));
          } catch (e) {
            console.error("[getStoreProducts] collection tail fetch failed for", n.id, e);
          }
        }
        products.push({
          id: n.id,
          title: n.title,
          handle: n.handle,
          url: (n.onlineStoreUrl as string) || (domain ? `https://${domain}/products/${n.handle}` : `/products/${n.handle}`),
          image: n.featuredImage?.url ?? null,
          price: price?.amount ? Number(price.amount).toFixed(2) : null,
          currency: price?.currencyCode ?? null,
          available: (n.totalInventory ?? 0) > 0 || n.totalInventory == null,
          collectionIds,
        });
      }
      if (!conn?.pageInfo?.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
    return { connected: true, products: products.slice(0, limit), ...(partial ? { error: "partial catalog" } : {}) };
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

type CollectionsResult = { connected: boolean; collections: StoreCollection[]; error?: string };
const _collectionsCache = new Map<number, { at: number; data: CollectionsResult; refreshing?: boolean }>();

export async function getStoreCollections(limit = 50): Promise<CollectionsResult> {
  const cached = _collectionsCache.get(limit);
  if (cached) {
    const fresh = Date.now() - cached.at < PRODUCTS_TTL;
    if (!fresh && !cached.refreshing) {
      cached.refreshing = true;
      fetchStoreCollections(limit)
        .then((data) => { if (data.connected && !data.error) _collectionsCache.set(limit, { at: Date.now(), data }); })
        .catch(() => {})
        .finally(() => { const c = _collectionsCache.get(limit); if (c) c.refreshing = false; });
    }
    return cached.data;
  }
  const data = await fetchStoreCollections(limit);
  if (data.connected && !data.error) _collectionsCache.set(limit, { at: Date.now(), data });
  return data;
}

async function fetchStoreCollections(limit: number): Promise<CollectionsResult> {
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

// Samples curation sits on top of the promotions catalog: every promo-visible
// product is sample-able by DEFAULT, and the admin turns specific ones OFF.
// We store the OFF list (`hidden`) rather than an allow-list so newly-visible
// products stay sample-able automatically and stale ids are harmless.
export interface SamplesConfig {
  order: string[];
  hidden: string[]; // product ids explicitly excluded from sampling
}

export async function getSamplesConfig(): Promise<SamplesConfig> {
  if (!db) return { order: [], hidden: [] };
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "samples_catalog_config") });
  if (!row?.value) return { order: [], hidden: [] };
  try {
    const c = JSON.parse(row.value);
    return {
      order: Array.isArray(c.order) ? c.order : [],
      hidden: Array.isArray(c.hidden) ? c.hidden : [],
    };
  } catch {
    return { order: [], hidden: [] };
  }
}

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

// ---------- Collection-aware visibility (the affiliate catalog model) ----------
// A product is visible to affiliates when it's live AND
//   (it belongs to an allowed collection OR is explicitly allowed)
//   AND is NOT explicitly hidden.
// Explicit hide always wins; explicit show works even outside allowed collections.

export interface CatalogVisibility {
  allowedCollections: string[]; // collection ids fully allowed (all their products show)
  allowedProducts: string[]; // product ids explicitly allowed
  hiddenProducts: string[]; // product ids explicitly hidden (override — always wins)
  featured: string[]; // product ids to surface first, in this order
  order: string[]; // optional manual order for the rest
}

const strArr = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);

export async function getCatalogVisibility(): Promise<CatalogVisibility> {
  const empty: CatalogVisibility = { allowedCollections: [], allowedProducts: [], hiddenProducts: [], featured: [], order: [] };
  if (!db) return empty;
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "catalog_visibility") });
  if (!row?.value) return empty;
  try {
    const c = JSON.parse(row.value);
    return {
      allowedCollections: strArr(c.allowedCollections),
      allowedProducts: strArr(c.allowedProducts),
      hiddenProducts: strArr(c.hiddenProducts),
      featured: strArr(c.featured),
      order: strArr(c.order),
    };
  } catch {
    return empty;
  }
}

/** Is a product visible to affiliates under the given rules? */
export function isProductVisible(p: StoreProduct, vis: CatalogVisibility): boolean {
  if (vis.hiddenProducts.includes(p.id)) return false;
  if (vis.allowedProducts.includes(p.id)) return true;
  const allowed = new Set(vis.allowedCollections);
  return p.collectionIds.some((c) => allowed.has(c));
}

/** The affiliate-visible products, ordered: featured first, then manual order, then title. */
export function resolveVisibleProducts(products: StoreProduct[], vis: CatalogVisibility): StoreProduct[] {
  const featPos = new Map(vis.featured.map((id, i) => [id, i] as const));
  const orderPos = new Map(vis.order.map((id, i) => [id, i] as const));
  return products
    .filter((p) => isProductVisible(p, vis))
    .sort((a, b) => {
      const fa = featPos.has(a.id), fb = featPos.has(b.id);
      if (fa && fb) return featPos.get(a.id)! - featPos.get(b.id)!;
      if (fa) return -1;
      if (fb) return 1;
      const oa = orderPos.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const ob = orderPos.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.title.localeCompare(b.title);
    });
}

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
