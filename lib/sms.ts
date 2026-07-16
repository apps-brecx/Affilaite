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
 * Twilio Messages API. The Account SID (AC…) always goes in the request URL.
 * Auth is either Account SID + Auth Token, or — when an API Key SID (SK…) is
 * provided — API Key SID + its secret (recommended). `from` is a sender number
 * (E.164) or a Messaging Service SID (starts with "MG").
 */
async function deliverTwilio(cfg: Awaited<ReturnType<typeof smsConfig>>, to: string, body: string): Promise<void> {
  const accountSid = cfg.accountSid.trim();
  const apiKeySid = cfg.apiKey.trim(); // optional SK… key
  const secret = cfg.apiSecret.trim(); // Auth Token, or API Key secret
  const from = cfg.from.trim();
  if (!accountSid.startsWith("AC")) {
    throw new Error("Twilio Account SID must start with 'AC' (find it on your Twilio Console dashboard).");
  }
  if (!secret || !from) {
    throw new Error("Twilio needs an Account SID (AC…), an Auth Token or API Key secret, and a From number.");
  }
  // Username = API Key SID when given, else the Account SID.
  const authUser = apiKeySid || accountSid;

  const params = new URLSearchParams({ To: to, Body: body });
  if (from.startsWith("MG")) params.set("MessagingServiceSid", from);
  else params.set("From", from);

  const auth = Buffer.from(`${authUser}:${secret}`).toString("base64");
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
