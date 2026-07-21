// lib/paypal.ts — OAuth token + Payouts client (idempotent batches).
// Reads credentials from the effective integration config (UI or env).
import { paypalConfig } from "./integrations";

export async function paypalToken(): Promise<string> {
  const { clientId, clientSecret, base } = await paypalConfig();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  // A 401 (bad creds) must NOT sail through as a successful token — otherwise
  // the payout path treats a failed auth as "sent" and marks commissions paid.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PayPal auth failed (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PayPal auth returned no access token");
  return json.access_token;
}

export interface PayoutRecipient {
  senderItemId: string;
  amount: string; // "12.00"
  receiver: string; // PayPal email, or phone number for Venmo
  method: "paypal" | "venmo";
  currency?: string;
}

/** Create a PayPal/Venmo payout batch. `senderBatchId` guarantees idempotency. */
export async function createPayoutBatch(senderBatchId: string, recipients: PayoutRecipient[]) {
  const { base } = await paypalConfig();
  const token = await paypalToken();
  const body = {
    sender_batch_header: {
      sender_batch_id: senderBatchId,
      email_subject: "Your affiliate commission is here 🎉",
      email_message: "Thanks for driving sales — here's your payout.",
    },
    items: recipients.map((r) => {
      const common = {
        amount: { value: r.amount, currency: r.currency ?? "USD" },
        receiver: r.receiver,
        note: "Affiliate commission",
        sender_item_id: r.senderItemId,
      };
      // Venmo payouts identify the recipient by phone number + wallet.
      return r.method === "venmo"
        ? { recipient_type: "PHONE", recipient_wallet: "VENMO", ...common }
        : { recipient_type: "EMAIL", ...common };
    }),
  };

  const res = await fetch(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Idempotency: PayPal dedupes retries carrying the same request id, so a
      // safe retry of the SAME batch never double-pays.
      "PayPal-Request-Id": senderBatchId,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    batch_header?: { payout_batch_id?: string };
    message?: string;
    name?: string;
  };
  // Treat any non-2xx (INSUFFICIENT_FUNDS, 401, 422, …) or a missing batch id as
  // a hard failure so the caller rolls back instead of marking money "paid".
  if (!res.ok || !json.batch_header?.payout_batch_id) {
    throw new Error(
      `PayPal payout failed (${res.status})${json.name ? ` ${json.name}` : ""}${json.message ? `: ${json.message}` : ""}`,
    );
  }
  return { payoutBatchId: json.batch_header.payout_batch_id, raw: json };
}

/**
 * Verify an inbound PayPal webhook against the configured webhook id via
 * PayPal's verify-webhook-signature API. Returns false (fail-closed) when the
 * webhook id isn't configured or verification doesn't come back SUCCESS.
 */
export async function verifyPaypalWebhook(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const { base, webhookId } = await paypalConfig();
  if (!webhookId) return false; // can't verify → don't trust it

  const transmissionId = headers.get("paypal-transmission-id");
  const transmissionTime = headers.get("paypal-transmission-time");
  const transmissionSig = headers.get("paypal-transmission-sig");
  const certUrl = headers.get("paypal-cert-url");
  const authAlgo = headers.get("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) return false;

  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(rawBody);
  } catch {
    return false;
  }

  try {
    const token = await paypalToken();
    const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { verification_status?: string };
    return json.verification_status === "SUCCESS";
  } catch (e) {
    console.error("[verifyPaypalWebhook]", e);
    return false;
  }
}

export async function getPayoutBatch(payoutBatchId: string) {
  const { base } = await paypalConfig();
  const token = await paypalToken();
  const res = await fetch(`${base}/v1/payments/payouts/${payoutBatchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PayPal get-batch failed (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

// PayPal payout-item transaction_status values, bucketed for our 4-state batch
// enum (draft/processing/success/failed). A dollar only counts as "paid" once
// its item reaches SUCCESS.
export const PAID_ITEM_STATUSES = ["SUCCESS"] as const;
const PENDING_ITEM_STATUSES = new Set(["PENDING", "UNCLAIMED", "ONHOLD", "NEW"]);
const FAILED_ITEM_STATUSES = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED", "CANCELED"]);

export interface ParsedPayoutItem {
  senderItemId: string;
  payoutItemId: string | null;
  transactionStatus: string;
}

/** Pull per-item statuses out of a PayPal get-batch response. */
export function parsePayoutBatch(raw: any): { batchStatus: string; items: ParsedPayoutItem[] } {
  const batchStatus = String(raw?.batch_header?.batch_status ?? "").toUpperCase();
  const items: ParsedPayoutItem[] = (raw?.items ?? []).map((i: any) => ({
    senderItemId: i?.payout_item?.sender_item_id ?? "",
    payoutItemId: i?.payout_item_id ?? null,
    transactionStatus: String(i?.transaction_status ?? "PENDING").toUpperCase(),
  }));
  return { batchStatus, items };
}

/**
 * Roll a set of item statuses up to a single batch status.
 * - any item still pending → "processing"
 * - some succeeded AND some terminally failed → "partial" (money moved for
 *   part of the batch; the failed items are reconciled back to unpaid)
 * - otherwise, at least one success → "success" (money moved)
 * - everything terminal-failed → "failed"
 */
export function rollupBatchStatus(itemStatuses: string[]): "processing" | "success" | "failed" | "partial" {
  if (itemStatuses.length === 0) return "processing";
  const norm = itemStatuses.map((s) => s.toUpperCase());
  if (norm.some((s) => PENDING_ITEM_STATUSES.has(s) || (!FAILED_ITEM_STATUSES.has(s) && s !== "SUCCESS"))) {
    return "processing";
  }
  const anySuccess = norm.some((s) => s === "SUCCESS");
  const anyFailed = norm.some((s) => FAILED_ITEM_STATUSES.has(s));
  // A mix means some affiliates were paid and some weren't — never report that
  // as a clean "success" (that's what hid unpaid affiliates before).
  if (anySuccess && anyFailed) return "partial";
  if (anySuccess) return "success";
  return "failed";
}
