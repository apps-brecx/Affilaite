// lib/shopify.ts — Admin GraphQL client + webhook HMAC verification.
// Reads credentials from the effective integration config (UI or env).
import crypto from "crypto";
import { shopifyConfig } from "./integrations";

export async function verifyShopifyHmac(rawBody: string, hmacHeader: string): Promise<boolean> {
  const { apiSecret } = await shopifyConfig();
  if (!apiSecret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", apiSecret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isThrottled = (json: any) =>
  Array.isArray(json?.errors) &&
  json.errors.some((e: any) => e?.extensions?.code === "THROTTLED" || /throttl/i.test(e?.message ?? ""));

export async function shopifyGraphQL<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { domain, token, version } = await shopifyConfig();
  if (!domain || !token) throw new Error("Shopify is not connected");
  const url = `https://${domain}/admin/api/${version}/graphql.json`;
  const MAX_ATTEMPTS = 4;

  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    });

    // HTTP 429: honor Retry-After, then back off. Shopify throttles aggressively.
    if (res.status === 429) {
      if (attempt >= MAX_ATTEMPTS) throw new Error("Shopify GraphQL 429 — rate limited, retries exhausted.");
      const retryAfter = Number(res.headers.get("Retry-After"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** (attempt - 1));
      continue;
    }
    if (!res.ok) {
      const hint =
        res.status === 401 || res.status === 403
          ? " — the Admin API access token was rejected. Check it's a valid token (starts with shpat_) with the right scopes."
          : res.status === 404
            ? " — check the store domain and API version."
            : "";
      throw new Error(`Shopify GraphQL ${res.status}${hint}`);
    }

    const json = (await res.json()) as any;
    // GraphQL-level throttling returns HTTP 200 with a THROTTLED error — retry.
    if (isThrottled(json) && attempt < MAX_ATTEMPTS) {
      await sleep(500 * 2 ** (attempt - 1));
      continue;
    }
    return json as T;
  }
}

/** Register the webhooks this app depends on. Run once during setup. */
export async function registerWebhooks(callbackUrl: string) {
  // ORDERS_FULFILLED + FULFILLMENTS_* drive the sample "auto-mark shipped" flow
  // (lib/samples.ts). Without them samples never leave "approved" and affiliates
  // never get the shipped notice, no matter how the webhook route handles them.
  const topics = [
    "ORDERS_CREATE",
    "ORDERS_PAID",
    "ORDERS_CANCELLED",
    "REFUNDS_CREATE",
    "ORDERS_FULFILLED",
    "FULFILLMENTS_CREATE",
    "FULFILLMENTS_UPDATE",
  ];
  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
        webhookSubscription { id }
        userErrors { field message }
      }
    }`;
  const results = [];
  for (const topic of topics) {
    results.push(await shopifyGraphQL(mutation, { topic, sub: { callbackUrl, format: "JSON" } }));
  }
  return results;
}
