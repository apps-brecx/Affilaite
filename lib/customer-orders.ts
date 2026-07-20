// lib/customer-orders.ts — an affiliate's OWN Shopify orders (as a customer),
// so they can track their purchases + shipping from the portal.
import { shopifyGraphQL } from "./shopify";
import { shopifyReady } from "./integrations";

export interface MyOrderLine {
  title: string;
  quantity: number;
  image: string | null;
}
export interface MyOrderTracking {
  number: string | null;
  url: string | null;
  company: string | null;
}
export interface MyOrder {
  id: string;
  name: string; // e.g. #1042
  createdAt: string;
  financialStatus: string; // PAID, REFUNDED…
  fulfillmentStatus: string; // FULFILLED, UNFULFILLED, PARTIALLY_FULFILLED…
  statusUrl: string | null; // customer-facing order status page
  total: string | null;
  currency: string | null;
  estimatedDelivery: string | null;
  lines: MyOrderLine[];
  tracking: MyOrderTracking[];
}

const QUERY = `
  query MyOrders($q: String!, $first: Int!) {
    customers(first: 1, query: $q) { edges { node { id } } }
    orders(first: $first, query: $q, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          displayFulfillmentStatus
          statusPageUrl
          currentTotalPriceSet { shopMoney { amount currencyCode } }
          lineItems(first: 20) { edges { node { title quantity image { url } } } }
          fulfillments(first: 10) {
            displayStatus
            estimatedDeliveryAt
            trackingInfo { number url company }
          }
        }
      }
    }
  }`;

/**
 * Fetch a customer's own orders by email. The email must match an existing
 * Shopify customer — if none does, `accountFound` is false so the UI can say
 * "Syruvia account not found". Never throws — returns a status.
 */
export async function getMyStoreOrders(
  email: string,
  limit = 25,
): Promise<{ connected: boolean; accountFound: boolean; orders: MyOrder[]; error?: string }> {
  if (!email || !(await shopifyReady())) return { connected: false, accountFound: false, orders: [] };
  try {
    // Quote the email so "+" / "." in addresses don't confuse the search syntax.
    const json: any = await shopifyGraphQL<any>(QUERY, { q: `email:"${email.replace(/"/g, "")}"`, first: Math.min(50, limit) });
    if (json.errors?.length) {
      console.error("[getMyStoreOrders] GraphQL errors:", json.errors);
      return { connected: true, accountFound: false, orders: [], error: json.errors.map((e: any) => e.message).join(", ") };
    }
    const accountFound = (json.data?.customers?.edges?.length ?? 0) > 0;
    if (!accountFound) return { connected: true, accountFound: false, orders: [] };
    const orders: MyOrder[] = (json.data?.orders?.edges ?? []).map((e: any) => {
      const n = e.node;
      const money = n.currentTotalPriceSet?.shopMoney;
      const tracking: MyOrderTracking[] = [];
      let eta: string | null = null;
      for (const f of n.fulfillments ?? []) {
        if (!eta && f.estimatedDeliveryAt) eta = f.estimatedDeliveryAt;
        for (const t of f.trackingInfo ?? []) {
          if (t?.number || t?.url) tracking.push({ number: t.number ?? null, url: t.url ?? null, company: t.company ?? null });
        }
      }
      return {
        id: n.id,
        name: n.name,
        createdAt: n.createdAt,
        financialStatus: n.displayFinancialStatus ?? "",
        fulfillmentStatus: n.displayFulfillmentStatus ?? "",
        statusUrl: n.statusPageUrl ?? null,
        total: money?.amount ? Number(money.amount).toFixed(2) : null,
        currency: money?.currencyCode ?? null,
        estimatedDelivery: eta,
        lines: (n.lineItems?.edges ?? []).map((le: any) => ({
          title: le.node?.title ?? "Item",
          quantity: le.node?.quantity ?? 1,
          image: le.node?.image?.url ?? null,
        })),
        tracking,
      };
    });
    return { connected: true, accountFound: true, orders };
  } catch (e: any) {
    console.error("[getMyStoreOrders]", e);
    return { connected: true, accountFound: false, orders: [], error: e?.message ?? "Could not reach Shopify" };
  }
}
