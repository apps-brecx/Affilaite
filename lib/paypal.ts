// lib/paypal.ts — OAuth token + Payouts client (idempotent batches).
const BASE = process.env.PAYPAL_BASE ?? "https://api-m.sandbox.paypal.com";

export async function paypalToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
  ).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export interface PayoutRecipient {
  senderItemId: string;
  amount: string; // "12.00"
  email: string;
  currency?: string;
}

/** Create a PayPal payout batch. `senderBatchId` guarantees idempotency. */
export async function createPayoutBatch(senderBatchId: string, recipients: PayoutRecipient[]) {
  const token = await paypalToken();
  const body = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: "Your affiliate commission is here 🎉",
      email_message: "Thanks for driving sales — here's your payout.",
    },
    items: recipients.map((r) => ({
      recipient_type: "EMAIL",
      amount: { value: r.amount, currency: r.currency ?? "USD" },
      receiver: r.email,
      note: "Affiliate commission",
      sender_item_id: r.senderItemId,
    })),
  };

  const res = await fetch(`${BASE}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": senderBatchId,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { batch_header?: { payout_batch_id?: string } };
  return { payoutBatchId: json.batch_header?.payout_batch_id, raw: json };
}

export async function getPayoutBatch(payoutBatchId: string) {
  const token = await paypalToken();
  const res = await fetch(`${BASE}/v1/payments/payouts/${payoutBatchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
