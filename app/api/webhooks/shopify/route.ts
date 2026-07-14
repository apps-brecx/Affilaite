import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyShopifyHmac } from "@/lib/shopify";
import { processOrderCreated, processRefund } from "@/lib/attribution";

export async function POST(req: Request) {
  const raw = await req.text(); // MUST use the raw body for HMAC verification
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";

  if (!(await verifyShopifyHmac(raw, hmac))) {
    return new Response("Invalid HMAC", { status: 401 });
  }

  const payload = JSON.parse(raw);
  const externalId = `${topic}:${String(payload.id ?? payload.admin_graphql_api_id)}`;

  if (db) {
    // Idempotency — skip events we've already processed.
    const seen = await db.query.webhookEvents.findFirst({
      where: and(eq(webhookEvents.source, "shopify"), eq(webhookEvents.externalId, externalId)),
    });
    if (seen?.processedAt) return new Response("ok", { status: 200 });

    await db
      .insert(webhookEvents)
      .values({ source: "shopify", topic, externalId, payload, processedAt: new Date() });
  }

  // Keep the response under Shopify's 5s limit; offload to a job for heavy work.
  try {
    if (topic === "orders/create") await processOrderCreated(payload);
    else if (topic === "refunds/create") await processRefund(payload);
  } catch (e) {
    console.error("[shopify webhook] processing error", e);
  }

  return new Response("ok", { status: 200 });
}
