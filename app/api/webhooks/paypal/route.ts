import { db } from "@/db";
import { payoutItems } from "@/db/schema";
import { eq } from "drizzle-orm";

// PayPal payout item status webhook → reconcile payout_items.
export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload) return new Response("bad request", { status: 400 });

  const resource = payload.resource ?? {};
  const senderItemId = resource.payout_item?.sender_item_id;
  const status = resource.transaction_status;
  const paypalItemId = resource.payout_item_id;

  if (db && senderItemId) {
    await db
      .update(payoutItems)
      .set({ transactionStatus: status, paypalItemId })
      .where(eq(payoutItems.id, senderItemId));
  }

  return new Response("ok", { status: 200 });
}
