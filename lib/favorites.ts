// lib/favorites.ts — "Shop my Favorites": one Shopify collection per affiliate.
//
// Each affiliate curates a manual Shopify collection. We create it on first save,
// keep membership in sync with their picks, publish it to the Online Store so the
// storefront URL works, and store the GID + handle + product ids on the affiliate.
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { shopifyGraphQL } from "./shopify";
import { shopifyConfig } from "./integrations";

export interface FavAffiliate {
  id: string;
  name: string;
  refCode: string;
  favoriteCollectionId: string | null;
  favoriteCollectionHandle: string | null;
  favoriteProductIds: string[] | null;
}

const uerrs = (arr: any): string => (Array.isArray(arr) && arr.length ? arr.map((e: any) => e.message).join("; ") : "");

// All of the store's publication (sales channel) ids — cached per process.
// Online Store, Shop, Point of Sale, Google & YouTube, Facebook & Instagram, etc.
let allPubIds: string[] | undefined;
async function allPublications(): Promise<string[]> {
  if (allPubIds !== undefined) return allPubIds;
  try {
    const j: any = await shopifyGraphQL(`{ publications(first: 50) { edges { node { id } } } }`);
    allPubIds = (j?.data?.publications?.edges ?? []).map((e: any) => e.node?.id).filter(Boolean);
  } catch {
    allPubIds = [];
  }
  return allPubIds ?? [];
}

/** Publish to EVERY sales channel (needs write_publications). Returns true on success. */
async function publishEverywhere(collectionId: string): Promise<boolean> {
  const pubs = await allPublications();
  if (!pubs.length) return false;
  try {
    const j: any = await shopifyGraphQL(
      `mutation Pub($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { message } } }`,
      { id: collectionId, input: pubs.map((publicationId) => ({ publicationId })) },
    );
    if (Array.isArray(j?.errors) && j.errors.length) return false;
    return true;
  } catch (e) {
    console.error("[favorites] publishablePublish failed (needs write_publications):", e);
    return false;
  }
}

/**
 * Publish the collection to the Online Store via the REST API's `published` flag.
 * This only needs write_products (which the store already has, since the
 * collection was created), so it works even without write_publications.
 */
async function publishOnlineStoreRest(collectionId: string): Promise<boolean> {
  const numeric = collectionId.split("/").pop();
  if (!numeric) return false;
  try {
    const { domain, token, version } = await shopifyConfig();
    if (!domain || !token) return false;
    const res = await fetch(`https://${domain}/admin/api/${version}/custom_collections/${numeric}.json`, {
      method: "PUT",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
      body: JSON.stringify({ custom_collection: { id: Number(numeric), published: true } }),
    });
    return res.ok;
  } catch (e) {
    console.error("[favorites] REST publish failed:", e);
    return false;
  }
}

const gqlErr = (r: any) => (Array.isArray(r?.errors) && r.errors.length ? r.errors.map((e: any) => e.message).join("; ") : "");
const handleFor = (refCode: string) => `favorites-${refCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 60);

/** True if the collection GID still resolves to a real collection in Shopify. */
async function collectionExists(id: string): Promise<boolean> {
  try {
    const j: any = await shopifyGraphQL(`query($id: ID!) { node(id: $id) { ... on Collection { id } } }`, { id });
    return !!j?.data?.node?.id;
  } catch {
    return false;
  }
}

async function createCollection(title: string, handle: string): Promise<{ id: string; handle: string }> {
  const q = `mutation Create($input: CollectionInput!) {
    collectionCreate(input: $input) { collection { id handle } userErrors { field message } }
  }`;
  const j: any = await shopifyGraphQL(q, { input: { title, handle, descriptionHtml: "A few of my favorite picks. Shop them all in one place." } });
  if (gqlErr(j)) throw new Error(gqlErr(j));
  const res = j?.data?.collectionCreate;
  const err = uerrs(res?.userErrors);
  // Handle already taken (e.g. an orphaned collection) → let Shopify pick one.
  if (!res?.collection?.id && /handle/i.test(err)) {
    const j2: any = await shopifyGraphQL(q, { input: { title, descriptionHtml: "A few of my favorite picks. Shop them all in one place." } });
    const res2 = j2?.data?.collectionCreate;
    if (!res2?.collection?.id) throw new Error(uerrs(res2?.userErrors) || gqlErr(j2) || "Shopify wouldn't create the collection.");
    return { id: res2.collection.id, handle: res2.collection.handle };
  }
  if (!res?.collection?.id) throw new Error(err || "Shopify wouldn't create the collection.");
  return { id: res.collection.id, handle: res.collection.handle };
}

/**
 * Return the affiliate's collection, creating a fresh one if they have none OR if
 * the stored one was deleted in Shopify. `created` = true means it's brand new
 * (empty), so the caller should add all picks rather than diff against old ids.
 */
async function ensureCollection(aff: FavAffiliate): Promise<{ id: string; handle: string; created: boolean }> {
  if (aff.favoriteCollectionId && (await collectionExists(aff.favoriteCollectionId))) {
    return { id: aff.favoriteCollectionId, handle: aff.favoriteCollectionHandle ?? handleFor(aff.refCode), created: false };
  }
  const c = await createCollection(`${aff.name}'s Favorites`, handleFor(aff.refCode));
  return { ...c, created: true };
}

async function addProducts(collectionId: string, productIds: string[]) {
  if (!productIds.length) return;
  const q = `mutation Add($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) { userErrors { message } }
  }`;
  const j: any = await shopifyGraphQL(q, { id: collectionId, productIds });
  const err = uerrs(j?.data?.collectionAddProducts?.userErrors);
  if (err) throw new Error(err);
}

async function removeProducts(collectionId: string, productIds: string[]) {
  if (!productIds.length) return;
  const q = `mutation Remove($id: ID!, $productIds: [ID!]!) {
    collectionRemoveProducts(id: $id, productIds: $productIds) { userErrors { message } }
  }`;
  const j: any = await shopifyGraphQL(q, { id: collectionId, productIds });
  const err = uerrs(j?.data?.collectionRemoveProducts?.userErrors);
  if (err) throw new Error(err);
}

/**
 * Reconcile the affiliate's collection to exactly `productIds`, creating +
 * publishing it if needed, then persist the collection + picks on the affiliate.
 * Returns the collection handle so callers can build the storefront URL.
 */
export async function syncFavorites(aff: FavAffiliate, productIds: string[]): Promise<{ handle: string; live: boolean }> {
  const clean = [...new Set(productIds.filter((p) => typeof p === "string" && p.startsWith("gid://shopify/Product/")))].slice(0, 250);
  const { id, handle, created } = await ensureCollection(aff);

  // A freshly (re)created collection starts empty, so add everything; otherwise
  // diff against what we last stored.
  const prev = new Set(created ? [] : aff.favoriteProductIds ?? []);
  const next = new Set(clean);
  const toAdd = clean.filter((p) => !prev.has(p));
  const toRemove = [...prev].filter((p) => !next.has(p));
  await addProducts(id, toAdd);
  await removeProducts(id, toRemove);

  // Make it live: REST `published` (needs only write_products, which we have) gets
  // it on the Online Store; publishablePublish adds every other channel when
  // write_publications is present. "live" = at least the storefront works.
  const restLive = await publishOnlineStoreRest(id);
  const channelsLive = await publishEverywhere(id);
  const live = restLive || channelsLive;

  if (db) {
    await db
      .update(affiliates)
      .set({ favoriteCollectionId: id, favoriteCollectionHandle: handle, favoriteProductIds: clean })
      .where(eq(affiliates.id, aff.id));
  }
  return { handle, live };
}

/** Storefront URL for a collection handle (public, on the store domain). */
export async function collectionUrl(handle: string | null | undefined): Promise<string | null> {
  if (!handle) return null;
  const { domain } = await shopifyConfig().catch(() => ({ domain: "" }) as any);
  if (!domain) return null;
  return `https://${domain}/collections/${handle}`;
}
