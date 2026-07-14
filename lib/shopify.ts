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

export async function shopifyGraphQL<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { domain, token, version } = await shopifyConfig();
  if (!domain || !token) throw new Error("Shopify is not connected");
  const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify GraphQL ${res.status}`);
  return res.json() as Promise<T>;
}

/** Register the webhooks this app depends on. Run once during setup. */
export async function registerWebhooks(callbackUrl: string) {
  const topics = ["ORDERS_CREATE", "ORDERS_UPDATED", "REFUNDS_CREATE"];
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
