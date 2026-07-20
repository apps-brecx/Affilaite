// lib/shopify-customers.ts — link an affiliate to a Shopify customer.
// On join we create a Shopify customer; if one already exists with that email
// we reuse it (link) instead of creating a duplicate. Best-effort: returns the
// customer GID or null, and never throws to the caller.
import { shopifyGraphQL } from "./shopify";
import { shopifyReady } from "./integrations";

const FIND = `
  query FindCustomer($q: String!) {
    customers(first: 1, query: $q) { edges { node { id } } }
  }`;

const FIND_FULL = `
  query FindCustomerFull($q: String!) {
    customers(first: 1, query: $q) {
      edges { node { id displayName defaultEmailAddress { emailAddress } } }
    }
  }`;

const BY_ID = `
  query CustomerById($id: ID!) {
    customer(id: $id) { id displayName defaultEmailAddress { emailAddress } }
  }`;

export interface LinkedCustomer {
  id: string;
  email: string | null;
  name: string | null;
}

/** Find an existing Shopify customer by email (no create). Null if none / offline. */
export async function findShopifyCustomerByEmail(email: string): Promise<LinkedCustomer | null> {
  const clean = (email ?? "").trim().toLowerCase();
  if (!clean || !(await shopifyReady())) return null;
  try {
    const json: any = await shopifyGraphQL(FIND_FULL, { q: `email:"${clean.replace(/"/g, "")}"` });
    const n = json?.data?.customers?.edges?.[0]?.node;
    return n ? { id: n.id, email: n.defaultEmailAddress?.emailAddress ?? clean, name: n.displayName ?? null } : null;
  } catch (e) {
    console.error("[findShopifyCustomerByEmail]", e);
    return null;
  }
}

/** Resolve a linked Shopify customer by GID (for display). Null if gone / offline. */
export async function getShopifyCustomerById(id: string): Promise<LinkedCustomer | null> {
  if (!id || !(await shopifyReady())) return null;
  try {
    const json: any = await shopifyGraphQL(BY_ID, { id });
    const n = json?.data?.customer;
    return n ? { id: n.id, email: n.defaultEmailAddress?.emailAddress ?? null, name: n.displayName ?? null } : null;
  } catch (e) {
    console.error("[getShopifyCustomerById]", e);
    return null;
  }
}

const CREATE = `
  mutation CreateCustomer($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }`;

function splitName(name?: string | null): { firstName?: string; lastName?: string } {
  const n = (name ?? "").trim();
  if (!n) return {};
  const [first, ...rest] = n.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") || undefined };
}

/**
 * Find-or-create a Shopify customer for this email. Returns the customer GID,
 * or null when Shopify isn't connected or the call fails (caller stays healthy).
 */
export async function upsertShopifyCustomer(email: string, name?: string | null): Promise<string | null> {
  if (!(await shopifyReady())) return null;
  const clean = email.trim().toLowerCase();
  if (!clean) return null;
  try {
    // 1) Already a customer? Link to it.
    const found: any = await shopifyGraphQL(FIND, { q: `email:${clean}` });
    const existing = found?.data?.customers?.edges?.[0]?.node?.id;
    if (existing) return existing as string;

    // 2) Otherwise create one.
    const created: any = await shopifyGraphQL(CREATE, { input: { email: clean, ...splitName(name), tags: ["affiliate"] } });
    const errs = created?.data?.customerCreate?.userErrors ?? [];
    if (errs.length) {
      // "email has already been taken" — race: fetch and link.
      const retry: any = await shopifyGraphQL(FIND, { q: `email:${clean}` });
      return retry?.data?.customers?.edges?.[0]?.node?.id ?? null;
    }
    return created?.data?.customerCreate?.customer?.id ?? null;
  } catch (e) {
    console.error("[upsertShopifyCustomer]", e);
    return null;
  }
}
