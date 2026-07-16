// lib/sms.ts — provider-agnostic SMS seam.
// Everything upstream (OTP generation, verification, the admin toggle, signup
// gating) is fully built. To go live, pick a provider and implement `deliver()`
// below — nothing else has to change.
import { smsConfig } from "./integrations";

export interface SmsResult {
  sent: boolean;
  simulated: boolean; // true when no provider is wired → nothing actually went out
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const cfg = await smsConfig();
  if (!cfg.provider) {
    // No provider configured — don't pretend a text was delivered. In demo
    // mode the code is logged so the flow is still testable end-to-end.
    console.info(`[sms:simulated] to=${to} :: ${body}`);
    return { sent: false, simulated: true };
  }
  try {
    await deliver(cfg, to, body);
    return { sent: true, simulated: false };
  } catch (e: any) {
    console.error("[sms] send failed:", e);
    return { sent: false, simulated: false, error: e?.message ?? "SMS send failed" };
  }
}

/**
 * The pluggable seam. Twilio is wired below; add other providers as new cases.
 */
async function deliver(cfg: Awaited<ReturnType<typeof smsConfig>>, to: string, body: string): Promise<void> {
  const provider = cfg.provider.trim().toLowerCase();
  if (provider === "twilio") return deliverTwilio(cfg, to, body);
  throw new Error(`SMS provider "${cfg.provider}" has no delivery adapter.`);
}

/**
 * Twilio Messages API. Uses the config's apiKey as the Account SID, apiSecret as
 * the Auth Token, and `from` as either a sender number (E.164) or a Messaging
 * Service SID (starts with "MG").
 */
async function deliverTwilio(cfg: Awaited<ReturnType<typeof smsConfig>>, to: string, body: string): Promise<void> {
  const accountSid = cfg.apiKey.trim();
  const authToken = cfg.apiSecret.trim();
  const from = cfg.from.trim();
  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio needs an Account SID, Auth Token, and a From number / Messaging Service SID.");
  }

  const params = new URLSearchParams({ To: to, Body: body });
  if (from.startsWith("MG")) params.set("MessagingServiceSid", from);
  else params.set("From", from);

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}
