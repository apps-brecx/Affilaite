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
 * The single pluggable seam. Drop your provider's API call in here — e.g. Twilio:
 *
 *   const auth = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString("base64");
 *   const res = await fetch(
 *     `https://api.twilio.com/2010-04-01/Accounts/${cfg.apiKey}/Messages.json`,
 *     { method: "POST", headers: { Authorization: `Basic ${auth}`,
 *       "Content-Type": "application/x-www-form-urlencoded" },
 *       body: new URLSearchParams({ To: to, From: cfg.from, Body: body }) });
 *   if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
 */
async function deliver(cfg: Awaited<ReturnType<typeof smsConfig>>, to: string, body: string): Promise<void> {
  void to;
  void body;
  throw new Error(`SMS provider "${cfg.provider}" is set but no delivery adapter is wired yet.`);
}
