// lib/sms.ts — phone verification via the Twilio Verify API.
// Twilio generates, delivers, and validates the one-time code; we never see or
// store it. No sender number is needed (Verify manages its own).
import twilio from "twilio";
import { smsConfig } from "./integrations";

export interface VerifyResult {
  sent: boolean;
  simulated: boolean; // true when Verify isn't configured — nothing was sent
  error?: string;
}

/** Are all three Twilio Verify credentials present? */
export async function verifyConfigured(): Promise<boolean> {
  const c = await smsConfig();
  return Boolean(c.accountSid && c.authToken && c.verifyServiceSid);
}

/** Ask Twilio Verify to send an SMS code to a phone number. */
export async function sendVerification(phone: string): Promise<VerifyResult> {
  const cfg = await smsConfig();
  if (!cfg.accountSid || !cfg.authToken || !cfg.verifyServiceSid) {
    console.info(`[verify:simulated] would send a code to ${phone}`);
    return { sent: false, simulated: true };
  }
  try {
    const client = twilio(cfg.accountSid, cfg.authToken);
    await client.verify.v2.services(cfg.verifyServiceSid).verifications.create({ to: phone, channel: "sms" });
    return { sent: true, simulated: false };
  } catch (e: any) {
    console.error("[sendVerification]", e);
    return { sent: false, simulated: false, error: twilioMessage(e) };
  }
}

/** Check a user-entered code with Twilio Verify. `approved` means verified. */
export async function checkVerification(phone: string, code: string): Promise<{ approved: boolean; error?: string }> {
  const cfg = await smsConfig();
  if (!cfg.accountSid || !cfg.authToken || !cfg.verifyServiceSid) {
    return { approved: false, error: "SMS verification isn't configured." };
  }
  try {
    const client = twilio(cfg.accountSid, cfg.authToken);
    const check = await client.verify.v2.services(cfg.verifyServiceSid).verificationChecks.create({ to: phone, code });
    return { approved: check.status === "approved" };
  } catch (e: any) {
    // A wrong code comes back as status "pending" (handled above); a throw here
    // means the verification expired / was already used / max attempts hit.
    console.error("[checkVerification]", e);
    if (e?.status === 404 || e?.code === 20404) {
      return { approved: false, error: "That code has expired — request a new one." };
    }
    return { approved: false, error: twilioMessage(e) };
  }
}

function twilioMessage(e: any): string {
  if (e?.code === 60200) return "That doesn't look like a valid phone number.";
  if (e?.code === 60203) return "Too many attempts for this number — wait a bit and try again.";
  if (e?.code === 60202) return "Max check attempts reached — request a new code.";
  if (e?.code === 20404) return "Verify Service not found — check the Verify Service SID (VA…).";
  if (e?.status === 401 || e?.code === 20003) return "Twilio auth failed — check the Account SID and Auth Token.";
  if (e?.code === 60205) return "SMS isn't supported for this number.";
  return e?.message ?? "Twilio Verify error";
}
