import { db } from "@/db";
import { payoutItems, payouts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaypalWebhook, rollupBatchStatus } from "@/lib/paypal";

// PayPal payout item status webhook → reconcile payout_items and roll the batch
// status up (processing → success/failed) so the admin UI reflects reality.
export async function POST(req: Request) {
  // MUST verify the signature before trusting anything — otherwise anyone who
  // guesses the URL could flip a real payout to SUCCESS/FAILED.
  const raw = await req.text();
  if (!(await verifyPaypalWebhook(req.headers, raw))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const resource = payload.resource ?? {};
  const senderItemId = resource.payout_item?.sender_item_id;
  const status = resource.transaction_status;
  const paypalItemId = resource.payout_item_id;

  if (db && senderItemId) {
    const [updated] = await db
      .update(payoutItems)
      .set({ transactionStatus: status, ...(paypalItemId ? { paypalItemId } : {}) })
      .where(eq(payoutItems.id, senderItemId))
      .returning({ payoutId: payoutItems.payoutId });

    // Roll the batch up from its items' latest statuses.
    if (updated?.payoutId) {
      const siblings = await db
        .select({ s: payoutItems.transactionStatus })
        .from(payoutItems)
        .where(eq(payoutItems.payoutId, updated.payoutId));
      const rolled = rollupBatchStatus(siblings.map((s) => s.s ?? "PENDING"));
      await db.update(payouts).set({ status: rolled }).where(eq(payouts.id, updated.payoutId));
    }
  }

  return new Response("ok", { status: 200 });
}
