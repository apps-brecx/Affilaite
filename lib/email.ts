// lib/email.ts — Resend wrapper for transactional + broadcast email.
// Reads credentials from the effective integration config (UI or env).
import { Resend } from "resend";
import { emailConfig } from "./integrations";

export async function sendEmail(to: string, subject: string, html: string) {
  const { apiKey, from } = await emailConfig();
  if (!apiKey) {
    console.warn("[email] Resend not connected — skipping send to", to);
    return { skipped: true };
  }
  const resend = new Resend(apiKey);
  return resend.emails.send({ from, to, subject, html });
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
export function wrapEmail(body: string) {
  const html = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;color:#1a1a17">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FFF7F1">
    <div style="font-size:22px;font-weight:700;color:#431431;margin-bottom:20px">Sip<span style="color:#FF5C9E">fluence</span></div>
    ${html}
  </div>`;
}

export async function sendBroadcast(
  recipients: { email: string; name?: string; code?: string; earnings?: string; link?: string }[],
  subject: string,
  body: string,
) {
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    try {
      await sendEmail(r.email, subject, `<div>${renderTemplate(body, r)}</div>`);
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}
