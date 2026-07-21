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

// PII-free: request only the id, matching upsertShopifyCustomer. Requesting
// customer PII (email/name) can be blocked by Shopify Protected Customer Data
// even when read_customers is granted, which would look like "not found".
const BY_ID = `
  query CustomerById($id: ID!) {
    customer(id: $id) { id }
  }`;

export interface LinkedCustomer {
  id: string;
  email: string | null;
  name: string | null;
}

/**
 * Find an existing Shopify customer by email (no create). Returns the id when
 * found, and surfaces any Shopify error so the caller can report the real cause
 * instead of a misleading "not found".
 */
export async function findShopifyCustomerByEmail(email: string): Promise<{ id: string | null; error: string | null }> {
  const clean = (email ?? "").trim().toLowerCase();
  if (!clean) return { id: null, error: null };
  if (!(await shopifyReady())) return { id: null, error: "The store isn't connected." };
  try {
    const json: any = await shopifyGraphQL(FIND, { q: `email:${clean}` });
    if (json?.errors?.length) return { id: null, error: json.errors.map((e: any) => e.message).join("; ") };
    return { id: json?.data?.customers?.edges?.[0]?.node?.id ?? null, error: null };
  } catch (e: any) {
    console.error("[findShopifyCustomerByEmail]", e);
    return { id: null, error: e?.message ?? "Could not reach Shopify" };
  }
}

export interface CustomerPrefill {
  name: string;
  company: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

const PREFILL = `
  query CustomerPrefill($q: String!) {
    customers(first: 1, query: $q) {
      edges { node {
        firstName lastName
        defaultAddress { address1 address2 city province provinceCode zip country countryCodeV2 company }
      } }
    }
  }`;

/**
 * Best-effort: pull the name + default shipping address for an existing customer
 * so the apply form can pre-fill it. Returns null when the store isn't connected,
 * there's no such customer, or Shopify's Protected Customer Data rules block the
 * PII fields (in which case the applicant just fills it in manually).
 */
export async function getCustomerPrefill(email: string): Promise<CustomerPrefill | null> {
  const clean = (email ?? "").trim().toLowerCase();
  if (!clean || !(await shopifyReady())) return null;
  try {
    const json: any = await shopifyGraphQL(PREFILL, { q: `email:"${clean}"` });
    if (json?.errors?.length) return null; // often Protected Customer Data — degrade quietly
    const n = json?.data?.customers?.edges?.[0]?.node;
    if (!n) return null;
    const a = n.defaultAddress ?? {};
    const name = [n.firstName, n.lastName].filter(Boolean).join(" ").trim();
    return {
      name,
      company: a.company ?? "",
      addressLine1: a.address1 ?? "",
      addressLine2: a.address2 ?? "",
      city: a.city ?? "",
      region: a.provinceCode || a.province || "",
      postalCode: a.zip ?? "",
      country: a.countryCodeV2 || a.country || "",
    };
  } catch (e) {
    console.error("[getCustomerPrefill]", e);
    return null;
  }
}

/** Does a linked Shopify customer id still resolve? (existence check, PII-free) */
export async function shopifyCustomerExists(id: string): Promise<boolean> {
  if (!id || !(await shopifyReady())) return false;
  try {
    const json: any = await shopifyGraphQL(BY_ID, { id });
    return !!json?.data?.customer?.id;
  } catch (e) {
    console.error("[shopifyCustomerExists]", e);
    return false;
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
