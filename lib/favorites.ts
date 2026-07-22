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

const handleFor = (refCode: string) => `favorites-${refCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 60);

/** Create the affiliate's collection if they don't have one yet. Returns {id, handle}. */
async function ensureCollection(aff: FavAffiliate): Promise<{ id: string; handle: string }> {
  if (aff.favoriteCollectionId && aff.favoriteCollectionHandle) {
    return { id: aff.favoriteCollectionId, handle: aff.favoriteCollectionHandle };
  }
  const title = `${aff.name}'s Favorites`;
  const wanted = handleFor(aff.refCode);
  const q = `mutation Create($input: CollectionInput!) {
    collectionCreate(input: $input) { collection { id handle } userErrors { field message } }
  }`;
  const j: any = await shopifyGraphQL(q, {
    input: { title, handle: wanted, descriptionHtml: `A few of my favorite picks. Shop them all in one place.` },
  });
  const res = j?.data?.collectionCreate;
  const err = uerrs(res?.userErrors);
  if (!res?.collection?.id) throw new Error(err || "Shopify wouldn't create the collection.");
  return { id: res.collection.id as string, handle: res.collection.handle as string };
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
  const { id, handle } = await ensureCollection(aff);

  const prev = new Set(aff.favoriteProductIds ?? []);
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
