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

/** Publish a collection to EVERY sales channel so it's live everywhere. Idempotent. */
async function publishEverywhere(collectionId: string) {
  const pubs = await allPublications();
  if (!pubs.length) return;
  try {
    await shopifyGraphQL(
      `mutation Pub($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { message } } }`,
      { id: collectionId, input: pubs.map((publicationId) => ({ publicationId })) },
    );
  } catch (e) {
    console.error("[favorites] publish to channels failed (collection exists, may need manual publish):", e);
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
export async function syncFavorites(aff: FavAffiliate, productIds: string[]): Promise<{ handle: string }> {
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

  // Publish to every sales channel each save — idempotent, and it backfills
  // collections created before the store had all its channels connected.
  await publishEverywhere(id);

  if (db) {
    await db
      .update(affiliates)
      .set({ favoriteCollectionId: id, favoriteCollectionHandle: handle, favoriteProductIds: clean })
      .where(eq(affiliates.id, aff.id));
  }
  return { handle };
}

/** Storefront URL for a collection handle (public, on the store domain). */
export async function collectionUrl(handle: string | null | undefined): Promise<string | null> {
  if (!handle) return null;
  const { domain } = await shopifyConfig().catch(() => ({ domain: "" }) as any);
  if (!domain) return null;
  return `https://${domain}/collections/${handle}`;
}
