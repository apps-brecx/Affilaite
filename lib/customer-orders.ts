// lib/customer-orders.ts — an affiliate's OWN Shopify orders (as a customer),
// so they can track their purchases + shipping from the portal.
//
// Linking strategy: prefer the affiliate's stored Shopify customer id (the
// definitive link, set when they were approved). Fall back to matching by email
// for affiliates created before that link existed.
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
  name: string;
  createdAt: string;
  financialStatus: string;
  fulfillmentStatus: string;
  statusUrl: string | null;
  total: string | null;
  currency: string | null;
  estimatedDelivery: string | null;
  lines: MyOrderLine[];
  tracking: MyOrderTracking[];
}

export interface MyOrdersResult {
  connected: boolean;
  accountFound: boolean;
  orders: MyOrder[];
  error?: string;
}

const ORDER_FIELDS = `
  id
  name
  createdAt
  displayFinancialStatus
  displayFulfillmentStatus
  statusPageUrl
  currentTotalPriceSet { shopMoney { amount currencyCode } }
  lineItems(first: 20) { edges { node { title quantity image { url } } } }
  fulfillments(first: 10) { displayStatus estimatedDeliveryAt trackingInfo { number url company } }`;

const BY_CUSTOMER = `
  query OrdersByCustomer($id: ID!, $first: Int!) {
    customer(id: $id) {
      id
      orders(first: $first, sortKey: CREATED_AT, reverse: true) {
        edges { node { ${ORDER_FIELDS} } }
      }
    }
  }`;

const BY_EMAIL = `
  query OrdersByEmail($q: String!, $first: Int!) {
    customers(first: 1, query: $q) { edges { node { id } } }
    orders(first: $first, query: $q, sortKey: CREATED_AT, reverse: true) {
      edges { node { ${ORDER_FIELDS} } }
    }
  }`;

function parseOrder(n: any): MyOrder {
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
}

/**
 * An affiliate's own store orders. Pass their linked Shopify customer id when
 * known (definitive); otherwise their email is matched to a Shopify customer.
 * When neither resolves to a customer, `accountFound` is false so the UI can
 * say "Syruvia account not found". Never throws.
 */
export async function getMyStoreOrders(
  opts: { email?: string | null; customerId?: string | null },
  limit = 25,
): Promise<MyOrdersResult> {
  const { email, customerId } = opts;
  if (!(await shopifyReady()) || (!email && !customerId)) {
    return { connected: false, accountFound: false, orders: [] };
  }
  const first = Math.min(50, limit);
  try {
    // 1) Definitive: the linked Shopify customer id.
    if (customerId) {
      const json: any = await shopifyGraphQL<any>(BY_CUSTOMER, { id: customerId, first });
      if (!json.errors?.length) {
        const cust = json.data?.customer;
        if (cust) {
          return { connected: true, accountFound: true, orders: (cust.orders?.edges ?? []).map((e: any) => parseOrder(e.node)) };
        }
        // Stored id no longer resolves (deleted customer) — fall through to email.
      } else {
        console.error("[getMyStoreOrders/customer] GraphQL errors:", json.errors);
      }
    }

    // 2) Fallback: match by email.
    if (email) {
      const json: any = await shopifyGraphQL<any>(BY_EMAIL, { q: `email:"${email.replace(/"/g, "")}"`, first });
      if (json.errors?.length) {
        console.error("[getMyStoreOrders/email] GraphQL errors:", json.errors);
        return { connected: true, accountFound: false, orders: [], error: json.errors.map((e: any) => e.message).join(", ") };
      }
      const accountFound = (json.data?.customers?.edges?.length ?? 0) > 0;
      if (!accountFound) return { connected: true, accountFound: false, orders: [] };
      return { connected: true, accountFound: true, orders: (json.data?.orders?.edges ?? []).map((e: any) => parseOrder(e.node)) };
    }

    return { connected: true, accountFound: false, orders: [] };
  } catch (e: any) {
    console.error("[getMyStoreOrders]", e);
    return { connected: true, accountFound: false, orders: [], error: e?.message ?? "Could not reach Shopify" };
  }
}
