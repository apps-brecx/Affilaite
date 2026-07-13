// lib/shopify.ts — Admin GraphQL client + webhook HMAC verification.
import crypto from "crypto";

const SHOP = process.env.SHOPIFY_STORE_DOMAIN ?? "";
const VER = process.env.SHOPIFY_API_VERSION ?? "2025-07";
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN ?? "";

export function verifyShopifyHmac(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_API_SECRET;
  if (!secret || !hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

export async function shopifyGraphQL<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${SHOP}/admin/api/${VER}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
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
    results.push(
      await shopifyGraphQL(mutation, { topic, sub: { callbackUrl, format: "JSON" } }),
    );
  }
  return results;
}
