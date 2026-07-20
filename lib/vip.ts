// lib/vip.ts — read a customer's Syruvia VIP standing from Shopify customer
// metafields (namespace "vip"), so affiliates see their points in the portal.
import { shopifyGraphQL } from "./shopify";
import { shopifyReady } from "./integrations";

export interface VipStatus {
  found: boolean;
  status: string | null; // e.g. "active"
  points: number | null;
  tier: string | null;
  nextTier: string | null;
  pointsToNext: number | null;
  lifetime: number | null;
  lifetimeSaved: number | null; // cents
}

const QUERY = `
  query MyVip($q: String!) {
    customers(first: 1, query: $q) {
      edges {
        node {
          id
          status: metafield(namespace: "vip", key: "status") { value }
          points: metafield(namespace: "vip", key: "points") { value }
          tier: metafield(namespace: "vip", key: "tier") { value }
          nextTier: metafield(namespace: "vip", key: "next_tier") { value }
          pointsToNext: metafield(namespace: "vip", key: "points_to_next") { value }
          lifetime: metafield(namespace: "vip", key: "lifetime") { value }
          lifetimeSaved: metafield(namespace: "vip", key: "lifetime_saved") { value }
        }
      }
    }
  }`;

const num = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);

/** Read the affiliate's own VIP standing by email. Never throws. */
export async function getMyVip(email: string): Promise<{ connected: boolean; vip: VipStatus; error?: string }> {
  const empty: VipStatus = { found: false, status: null, points: null, tier: null, nextTier: null, pointsToNext: null, lifetime: null, lifetimeSaved: null };
  if (!email || !(await shopifyReady())) return { connected: false, vip: empty };
  try {
    const json: any = await shopifyGraphQL<any>(QUERY, { q: `email:"${email.replace(/"/g, "")}"` });
    if (json.errors?.length) {
      console.error("[getMyVip] GraphQL errors:", json.errors);
      return { connected: true, vip: empty, error: json.errors.map((e: any) => e.message).join(", ") };
    }
    const node = json.data?.customers?.edges?.[0]?.node;
    if (!node) return { connected: true, vip: empty };
    return {
      connected: true,
      vip: {
        found: true,
        status: str(node.status?.value),
        points: num(node.points?.value),
        tier: str(node.tier?.value),
        nextTier: str(node.nextTier?.value),
        pointsToNext: num(node.pointsToNext?.value),
        lifetime: num(node.lifetime?.value),
        lifetimeSaved: num(node.lifetimeSaved?.value),
      },
    };
  } catch (e: any) {
    console.error("[getMyVip]", e);
    return { connected: true, vip: empty, error: e?.message ?? "Could not reach Shopify" };
  }
}
