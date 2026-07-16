import { db } from "@/db";
import { payoutItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyPaypalWebhook } from "@/lib/paypal";

// PayPal payout item status webhook → reconcile payout_items.
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
    await db
      .update(payoutItems)
      .set({ transactionStatus: status, paypalItemId })
      .where(eq(payoutItems.id, senderItemId));
  }

  return new Response("ok", { status: 200 });
}
