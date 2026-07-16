// lib/address.ts — structured shipping address helpers.
// Affiliates enter address as discrete fields; we keep the parts AND a composed
// single-line string (`address`) so samples / Shopify draft orders keep working.

export interface AddressParts {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  region?: string | null; // state / province
  postalCode?: string | null;
  country?: string | null;
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Normalize raw form input into trimmed parts (empty strings become null-ish ""). */
export function normalizeAddress(input: AddressParts): Required<Record<keyof AddressParts, string>> {
  return {
    line1: clean(input.line1),
    line2: clean(input.line2),
    city: clean(input.city),
    region: clean(input.region),
    postalCode: clean(input.postalCode),
    country: clean(input.country),
  };
}

/** True if at least the street + city are filled in (enough to ship to). */
export function hasShippableAddress(input: AddressParts): boolean {
  const a = normalizeAddress(input);
  return Boolean(a.line1 && a.city);
}

/** Compose the parts into a single readable line for display / Shopify. */
export function composeAddress(input: AddressParts): string {
  const a = normalizeAddress(input);
  // "City, Region PostalCode" reads naturally as one segment.
  const cityRegion = [a.city, a.region].filter(Boolean).join(", ");
  const cityLine = [cityRegion, a.postalCode].filter(Boolean).join(" ");
  return [a.line1, a.line2, cityLine, a.country].filter(Boolean).join(", ");
}
