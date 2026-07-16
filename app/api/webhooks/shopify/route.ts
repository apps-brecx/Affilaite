import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyShopifyHmac } from "@/lib/shopify";
import { processOrderCreated, processRefund, processCancelledOrder } from "@/lib/attribution";

async function dispatch(topic: string, payload: any) {
  if (topic === "orders/create" || topic === "orders/paid") await processOrderCreated(payload);
  else if (topic === "orders/cancelled") await processCancelledOrder(payload);
  else if (topic === "refunds/create") await processRefund(payload);
}

export async function POST(req: Request) {
  const raw = await req.text(); // MUST use the raw body for HMAC verification
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  const topic = req.headers.get("x-shopify-topic") ?? "";

  if (!(await verifyShopifyHmac(raw, hmac))) {
    return new Response("Invalid HMAC", { status: 401 });
  }

  const payload = JSON.parse(raw);
  const externalId = `${topic}:${String(payload.id ?? payload.admin_graphql_api_id)}`;

  // No DB → just process best-effort (demo mode).
  if (!db) {
    try {
      await dispatch(topic, payload);
    } catch (e) {
      console.error("[shopify webhook] processing error (no db)", e);
    }
    return new Response("ok", { status: 200 });
  }

  // Idempotency gate: the unique (source, external_id) index means the INSERT
  // itself claims this event. If we don't win the insert, someone else already
  // has it — skip only when they finished (processedAt set); otherwise a prior
  // attempt failed mid-flight and we reprocess (processing is idempotent).
  const [inserted] = await db
    .insert(webhookEvents)
    .values({ source: "shopify", topic, externalId, payload })
    .onConflictDoNothing({ target: [webhookEvents.source, webhookEvents.externalId] })
    .returning({ id: webhookEvents.id });

  let rowId: string | undefined = inserted?.id;
  if (!rowId) {
    const existing = await db.query.webhookEvents.findFirst({
      where: and(eq(webhookEvents.source, "shopify"), eq(webhookEvents.externalId, externalId)),
    });
    if (existing?.processedAt) return new Response("ok", { status: 200 }); // already done
    rowId = existing?.id;
  }

  try {
    await dispatch(topic, payload);
  } catch (e) {
    // Leave processedAt NULL and fail so Shopify retries (5xx triggers retry).
    console.error("[shopify webhook] processing error", e);
    return new Response("processing failed", { status: 500 });
  }

  // Mark processed only after success, so a lost/failed attribution is retried.
  if (rowId) await db.update(webhookEvents).set({ processedAt: new Date() }).where(eq(webhookEvents.id, rowId));
  return new Response("ok", { status: 200 });
}
