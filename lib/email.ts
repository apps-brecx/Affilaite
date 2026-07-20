// lib/email.ts — Resend wrapper for transactional + broadcast email.
// Reads credentials from the effective integration config (UI or env).
import { Resend } from "resend";
import { emailConfig } from "./integrations";

export async function sendEmail(to: string, subject: string, html: string, fromName?: string) {
  const { apiKey, from } = await emailConfig();
  if (!apiKey) {
    console.warn("[email] Resend not connected — skipping send to", to);
    return { skipped: true as const };
  }
  const resend = new Resend(apiKey);
  // Optional display name: keep the verified address, swap the friendly name.
  let fromHeader = from;
  if (fromName && fromName.trim() && from) {
    const m = from.match(/<([^>]+)>/);
    const addr = m ? m[1] : from.trim();
    fromHeader = `${fromName.trim()} <${addr}>`;
  }
  // Resend v4 resolves with { data, error } instead of throwing — surface the
  // error so callers don't report "sent" when nothing was delivered.
  const { data, error } = await resend.emails.send({ from: fromHeader, to, subject, html });
  if (error) throw new Error(`Resend: ${error.message ?? JSON.stringify(error)}`);
  return { id: data?.id };
}

/**
 * Fire-and-forget transactional email — wraps the body in the branded shell and
 * never throws, so a mail hiccup can't break the signup/approve/payout flow.
 * Returns true only when a message was actually handed to Resend.
 */
export async function sendEmailSafe(to: string, subject: string, bodyText: string): Promise<boolean> {
  if (!to) return false;
  try {
    const res: any = await sendEmail(to, subject, wrapEmail(bodyText));
    return !res?.skipped;
  } catch (e) {
    console.error("[email] lifecycle send failed:", e);
    return false;
  }
}

/** Personalize a body with an affiliate's variables. */
export function renderTemplate(
  body: string,
  vars: {
    name?: string;
    code?: string;
    earnings?: string;
    link?: string;
    loginUrl?: string;
    tempPassword?: string;
  },
) {
  return body
    .replaceAll("{{name}}", vars.name ?? "there")
    .replaceAll("{{code}}", vars.code ?? "")
    .replaceAll("{{earnings}}", vars.earnings ?? "$0.00")
    .replaceAll("{{link}}", vars.link ?? "")
    .replaceAll("{{loginUrl}}", vars.loginUrl ?? "")
    .replaceAll("{{tempPassword}}", vars.tempPassword ?? "");
}

/** Wrap a plain-text/markdown-ish body in a simple branded HTML shell. */
export function wrapEmail(body: string, cta?: { text: string; url: string }) {
  const html = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#1a1a17">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const button =
    cta?.text && cta?.url
      ? `<a href="${cta.url}" style="display:inline-block;margin-top:8px;padding:12px 26px;background:#FF5C9E;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600">${cta.text}</a>`
      : "";
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FFF7F1">
    <div style="font-size:22px;font-weight:700;color:#431431;margin-bottom:20px">Sip<span style="color:#FF5C9E">fluence</span></div>
    ${html}
    ${button}
  </div>`;
}

export async function sendBroadcast(
  recipients: { email: string; name?: string; code?: string; earnings?: string; link?: string }[],
  subject: string,
  body: string,
  cta?: { text: string; url: string },
) {
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      await sendEmail(r.email, subject, wrapEmail(renderTemplate(body, r), cta));
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
