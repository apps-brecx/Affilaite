// lib/email.ts — Resend wrapper for transactional + broadcast email.
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "Affilaite <affiliates@yourbrand.com>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping send to", to);
    return { skipped: true };
  }
  return resend.emails.send({ from: FROM, to, subject, html });
}

/** Personalize a broadcast body with an affiliate's variables. */
export function renderTemplate(
  body: string,
  vars: { name?: string; code?: string; earnings?: string; link?: string },
) {
  return body
    .replaceAll("{{name}}", vars.name ?? "there")
    .replaceAll("{{code}}", vars.code ?? "")
    .replaceAll("{{earnings}}", vars.earnings ?? "$0.00")
    .replaceAll("{{link}}", vars.link ?? "");
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
