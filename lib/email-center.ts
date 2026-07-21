// lib/email-center.ts — the Affiliate Notification Center.
//
// One registry of every automatic ("lifecycle") email the app sends. Admins can
// turn each on/off, rewrite the subject & body, add a call-to-action button and
// a hero image, and preview/test it — all stored in app_settings under
// `email:<key>` so no migration is needed.
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getBrand } from "@/lib/queries";
import { sendEmail } from "@/lib/email";

export type EmailCategory = "Onboarding" | "Sales" | "Payouts" | "Security";

export interface EmailVar {
  token: string; // e.g. "{{name}}"
  label: string;
}

export interface EmailType {
  key: string;
  label: string;
  description: string;
  category: EmailCategory;
  /** Plain-English description of when this fires. */
  whenText: string;
  /** A short best-practice tip shown to the admin. */
  recommendation: string;
  /** Merge variables available in this email. */
  variables: EmailVar[];
  /** Security emails (password reset) can't be switched off. */
  togglable: boolean;
  /** notificationPrefs key that also gates this per-affiliate (null = always). */
  prefKey: string | null;
  defaultSubject: string;
  defaultBody: string;
  defaultCtaText: string;
  defaultCtaUrl: string; // may contain {{loginUrl}} etc.
}

/** The admin-editable overlay stored per email type. */
export interface EmailTemplate {
  enabled: boolean;
  subject: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  buttonColor: string; // per-email hex override; "" = use the global brand
}

/** Global email branding — logo, colours, and one footer for every email. */
export interface EmailBrand {
  logoText: string;
  logoUrl: string; // image URL; when set, shown instead of the text logo
  primaryColor: string; // hex — headings/accents
  buttonColor: string; // hex — default CTA button background
  footerText: string; // shown at the foot of every email ({{logo}} allowed)
}

const V = {
  name: { token: "{{name}}", label: "Partner's first name" },
  code: { token: "{{code}}", label: "Their discount code" },
  amount: { token: "{{amount}}", label: "Amount (e.g. 12.50)" },
  currency: { token: "{{currency}}", label: "Currency (e.g. USD)" },
  earnings: { token: "{{earnings}}", label: "Total earned so far" },
  loginUrl: { token: "{{loginUrl}}", label: "Sign-in link" },
  dashboardUrl: { token: "{{dashboardUrl}}", label: "Dashboard link" },
  link: { token: "{{link}}", label: "Action link" },
  campaign: { token: "{{campaign}}", label: "Campaign name" },
} as const;

/** Every lifecycle email, in the order shown in the Notification Center. */
export const EMAIL_TYPES: EmailType[] = [
  {
    key: "application_received",
    label: "Application received",
    description: "Confirms we got a new partner application (approval-based signups).",
    category: "Onboarding",
    whenText: "Immediately after someone applies and is awaiting review.",
    recommendation: "Set expectations — tell them how long review takes so they don't wonder.",
    variables: [V.name],
    togglable: true,
    prefKey: null,
    defaultSubject: "We got your application 🎉",
    defaultBody:
      "Hi {{name}},\n\nThanks for applying to the Sipfluence partner program. We're reviewing your details and will email you as soon as you're approved.",
    defaultCtaText: "",
    defaultCtaUrl: "",
  },
  {
    key: "campaign_added",
    label: "Added to a campaign",
    description: "Tells a partner they've been added to a specific campaign.",
    category: "Onboarding",
    whenText: "When an admin adds an affiliate to a campaign (or invites them into one).",
    recommendation: "Name the campaign and their reward, and link them to sign in and grab their code.",
    variables: [V.name, V.campaign, V.code, V.loginUrl],
    togglable: true,
    prefKey: null,
    defaultSubject: "You've been added to {{campaign}} 🎉",
    defaultBody:
      "Hi {{name}},\n\nYou've been added to the {{campaign}} campaign on Sipfluence. Your discount code is {{code}} — sign in to grab your link and start earning.",
    defaultCtaText: "Sign in",
    defaultCtaUrl: "{{loginUrl}}",
  },
  {
    key: "instant_welcome",
    label: "Instant welcome",
    description: "Welcomes partners who join a campaign that approves instantly.",
    category: "Onboarding",
    whenText: "Right after joining a campaign with instant approval.",
    recommendation: "Get them to their code fast — a clear sign-in button lifts first-share rates.",
    variables: [V.name, V.loginUrl],
    togglable: true,
    prefKey: null,
    defaultSubject: "You're in! 🎉",
    defaultBody:
      "Hi {{name}},\n\nYour Sipfluence partner account is ready. Sign in to grab your code and referral link, and start earning.",
    defaultCtaText: "Sign in & get started",
    defaultCtaUrl: "{{loginUrl}}",
  },
  {
    key: "approved",
    label: "Application approved",
    description: "Tells a pending partner they've been approved.",
    category: "Onboarding",
    whenText: "When an admin approves a pending application.",
    recommendation: "Include their discount code so they can share the moment they read it.",
    variables: [V.name, V.code, V.loginUrl],
    togglable: true,
    prefKey: null,
    defaultSubject: "You're approved 🎉",
    defaultBody:
      "Hi {{name}},\n\nYour Sipfluence partner account is approved. Sign in to grab your link and start earning. Your discount code is {{code}}.",
    defaultCtaText: "Sign in & start earning",
    defaultCtaUrl: "{{loginUrl}}",
  },
  {
    key: "first_sale",
    label: "First sale 🎉",
    description: "A celebratory milestone email for a partner's very first commission.",
    category: "Sales",
    whenText: "The first time a sale is attributed to a partner.",
    recommendation: "Celebrate hard — the first sale is the biggest retention moment you have.",
    variables: [V.name, V.amount, V.currency, V.earnings],
    togglable: true,
    prefKey: "newCommission",
    defaultSubject: "You made your first sale 🎉",
    defaultBody:
      "Congrats {{name}} — you just earned your first commission of {{currency}} {{amount}}! Keep sharing your link and code to keep them coming.",
    defaultCtaText: "View my dashboard",
    defaultCtaUrl: "{{dashboardUrl}}",
  },
  {
    key: "repeat_sale",
    label: "New sale (cha-ching)",
    description: "The everyday 'you earned a commission' alert for repeat sales.",
    category: "Sales",
    whenText: "Every attributed sale after the first.",
    recommendation: "Keep it short and momentum-y. Show the running total to reinforce the habit.",
    variables: [V.name, V.amount, V.currency, V.earnings],
    togglable: true,
    prefKey: "newCommission",
    defaultSubject: "💰 Cha-ching! You just earned {{currency}} {{amount}}",
    defaultBody:
      "Another sale landed, {{name}} — you just earned {{currency}} {{amount}}. Your running total keeps climbing. Keep it up! 🚀",
    defaultCtaText: "View my dashboard",
    defaultCtaUrl: "{{dashboardUrl}}",
  },
  {
    key: "payout_sent",
    label: "Payout sent 💸",
    description: "Notifies a partner that money is on the way.",
    category: "Payouts",
    whenText: "When a payout is issued to the partner.",
    recommendation: "Reassure — state the amount and that it's on its way. Trust drives loyalty.",
    variables: [V.name, V.amount, V.currency],
    togglable: true,
    prefKey: "payoutSent",
    defaultSubject: "Your payout is on its way 💸",
    defaultBody:
      "Good news {{name}} — a payout of {{currency}} {{amount}} is on its way to you. Thanks for driving sales!",
    defaultCtaText: "",
    defaultCtaUrl: "",
  },
  {
    key: "password_reset",
    label: "Password reset",
    description: "The security email with a reset link. Always on — can't be disabled.",
    category: "Security",
    whenText: "When someone requests a password reset.",
    recommendation: "Keep {{link}} in the body — it's the reset link. Don't remove it.",
    variables: [V.name, V.link],
    togglable: false,
    prefKey: null,
    defaultSubject: "Reset your Sipfluence password",
    defaultBody:
      "Hi {{name}},\n\nWe got a request to reset your password. Click the button below to choose a new one. If you didn't ask for this, you can safely ignore this email.",
    defaultCtaText: "Reset my password",
    defaultCtaUrl: "{{link}}",
  },
];

export function emailTypeByKey(key: string): EmailType | undefined {
  return EMAIL_TYPES.find((t) => t.key === key);
}

function settingKey(key: string) {
  return `email:${key}`;
}

/** Defaults for a type as a full EmailTemplate. */
export function defaultTemplate(t: EmailType): EmailTemplate {
  return {
    enabled: true,
    subject: t.defaultSubject,
    body: t.defaultBody,
    ctaText: t.defaultCtaText,
    ctaUrl: t.defaultCtaUrl,
    imageUrl: "",
    buttonColor: "",
  };
}

const DEFAULT_FOOTER = "You're receiving this because you're a {{logo}} partner. Manage your email preferences in your dashboard settings.";

/** Global email branding, merged from app_settings onto the store brand. */
export async function getEmailBrand(): Promise<EmailBrand> {
  const store = await getBrand();
  const base: EmailBrand = {
    logoText: store.logoText || "Sipfluence",
    logoUrl: "",
    primaryColor: store.primaryColor || "#FF5C9E",
    buttonColor: store.primaryColor || "#FF5C9E",
    footerText: DEFAULT_FOOTER,
  };
  if (!db) return base;
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, "email_brand") });
  if (!row?.value) return base;
  try {
    const s = JSON.parse(row.value) as Partial<EmailBrand>;
    return {
      logoText: s.logoText?.trim() || base.logoText,
      logoUrl: s.logoUrl?.trim() ?? base.logoUrl,
      primaryColor: s.primaryColor?.trim() || base.primaryColor,
      buttonColor: s.buttonColor?.trim() || base.buttonColor,
      footerText: s.footerText ?? base.footerText,
    };
  } catch {
    return base;
  }
}

/** The effective template = stored overrides merged onto defaults. */
export async function getEmailTemplate(key: string): Promise<{ type: EmailType; tpl: EmailTemplate } | null> {
  const type = emailTypeByKey(key);
  if (!type) return null;
  const base = defaultTemplate(type);
  if (!db) return { type, tpl: base };
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, settingKey(key)) });
  if (!row?.value) return { type, tpl: base };
  try {
    const stored = JSON.parse(row.value) as Partial<EmailTemplate>;
    return {
      type,
      tpl: {
        enabled: type.togglable ? stored.enabled !== false : true,
        subject: stored.subject ?? base.subject,
        body: stored.body ?? base.body,
        ctaText: stored.ctaText ?? base.ctaText,
        ctaUrl: stored.ctaUrl ?? base.ctaUrl,
        imageUrl: stored.imageUrl ?? base.imageUrl,
        buttonColor: stored.buttonColor ?? base.buttonColor,
      },
    };
  } catch {
    return { type, tpl: base };
  }
}

/** All templates for the admin center. */
export async function getAllEmailTemplates(): Promise<{ type: EmailType; tpl: EmailTemplate }[]> {
  const out: { type: EmailType; tpl: EmailTemplate }[] = [];
  for (const type of EMAIL_TYPES) {
    const r = await getEmailTemplate(type.key);
    if (r) out.push(r);
  }
  return out;
}

/** Replace every {{token}} present in vars; leave unknown tokens blank. */
export function fillVars(str: string, vars: Record<string, string | undefined>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

// ---------- Custom (admin-authored) emails ----------

export interface CustomEmail {
  id: string;
  name: string;
  subject: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  buttonColor: string;
}

const CUSTOM_KEY = "email_custom";

export async function listCustomEmails(): Promise<CustomEmail[]> {
  if (!db) return [];
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, CUSTOM_KEY) });
  if (!row?.value) return [];
  try {
    const arr = JSON.parse(row.value);
    return Array.isArray(arr) ? (arr as CustomEmail[]) : [];
  } catch {
    return [];
  }
}

export async function getCustomEmail(id: string): Promise<CustomEmail | null> {
  return (await listCustomEmails()).find((c) => c.id === id) ?? null;
}

/** Persist the full custom-email list (write path used by the actions). */
export async function writeCustomEmails(list: CustomEmail[]): Promise<void> {
  if (!db) return;
  await db
    .insert(appSettings)
    .values({ key: CUSTOM_KEY, value: JSON.stringify(list) })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(list), updatedAt: new Date() } });
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-f]{6}$/i.test(c.trim()) ? c.trim() : fallback);

/**
 * Render a full branded HTML email from a body + optional CTA/image, using the
 * global email brand (logo, colours, footer). `buttonColor` overrides the
 * brand's button colour for this one email. Body newlines become paragraphs.
 */
export function renderRichEmail(opts: {
  body: string;
  brand: EmailBrand;
  cta?: { text: string; url: string };
  imageUrl?: string;
  buttonColor?: string;
  preheader?: string;
}): string {
  const { body, brand, cta, imageUrl } = opts;
  const primary = hex(brand.primaryColor, "#FF5C9E");
  // Hidden preview text (shown in the inbox list, not the body).
  const preheader = opts.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader.trim())}</div>`
    : "";
  const btnColor = hex(opts.buttonColor, hex(brand.buttonColor, primary));
  const logoText = esc(brand.logoText || "Sipfluence");
  const paras = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.65;color:#1a1a17;font-size:15px">${esc(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
  const hero =
    imageUrl && /^https?:\/\//i.test(imageUrl)
      ? `<img src="${esc(imageUrl)}" alt="" style="display:block;width:100%;max-width:472px;border-radius:14px;margin:0 0 20px" />`
      : "";
  const safeCtaUrl = cta?.url && /^(https?:|mailto:)/i.test(cta.url.trim()) ? cta.url.trim() : "";
  const button =
    cta?.text && safeCtaUrl
      ? `<a href="${esc(safeCtaUrl)}" style="display:inline-block;margin-top:6px;padding:13px 28px;background:${btnColor};color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;font-size:15px">${esc(cta.text)}</a>`
      : "";
  const logoBlock =
    brand.logoUrl && /^https?:\/\//i.test(brand.logoUrl)
      ? `<img src="${esc(brand.logoUrl)}" alt="${logoText}" style="display:block;height:34px;margin-bottom:22px" />`
      : `<div style="font-size:22px;font-weight:800;color:${primary};margin-bottom:22px">${logoText}</div>`;
  const footerRaw = (brand.footerText ?? "").trim();
  const footer = footerRaw
    ? `<hr style="border:none;border-top:1px solid #efe4da;margin:28px 0 14px" />
  <p style="margin:0;font-size:12px;color:#9a8f86;line-height:1.5">${esc(footerRaw.replace(/\{\{logo\}\}/g, brand.logoText || "Sipfluence")).replace(/\n/g, "<br/>")}</p>`
    : "";
  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;background:#FFF7F1">
  ${preheader}
  ${logoBlock}
  ${hero}
  ${paras}
  ${button}
  ${footer}
</div>`;
}

// ---------- Team invite email (fully admin-controlled) ----------

export interface TeamInviteEmail {
  fromName: string;
  subject: string;
  preheader: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  imageUrl: string;
  buttonColor: string;
  // Text shown on the login screen when an invited member arrives via the
  // invite link (?welcome=1), instead of the default "Welcome back".
  loginHeadline: string;
  loginSubtext: string;
}

const TEAM_INVITE_KEY = "team_invite_email";

export function defaultTeamInviteEmail(): TeamInviteEmail {
  return {
    fromName: "",
    subject: "You've been added to the {{brand}} admin",
    preheader: "Your admin access is ready — sign in to get started.",
    body: "Hi {{name}},\n\nYou've been given access to the {{brand}} admin portal. Sign in with the temporary password below, then change it from your account settings.\n\nTemporary password: {{tempPassword}}",
    buttonLabel: "Sign in",
    buttonUrl: "{{loginUrl}}",
    imageUrl: "",
    buttonColor: "",
    loginHeadline: "Welcome",
    loginSubtext: "Sign in to get started.",
  };
}

export async function getTeamInviteEmail(): Promise<TeamInviteEmail> {
  const d = defaultTeamInviteEmail();
  if (!db) return d;
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, TEAM_INVITE_KEY) });
  if (!row?.value) return d;
  try {
    const s = JSON.parse(row.value) as Partial<TeamInviteEmail>;
    return { ...d, ...s };
  } catch {
    return d;
  }
}

export async function writeTeamInviteEmail(tpl: TeamInviteEmail): Promise<void> {
  if (!db) return;
  const value = JSON.stringify(tpl);
  await db
    .insert(appSettings)
    .values({ key: TEAM_INVITE_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

/**
 * Render a lifecycle email (subject + html) for a given type and merge vars,
 * applying the admin's overrides. Returns null if the type is unknown.
 */
export async function renderEmailForType(
  key: string,
  vars: Record<string, string | undefined>,
): Promise<{ subject: string; html: string; enabled: boolean } | null> {
  const r = await getEmailTemplate(key);
  if (!r) return null;
  const brand = await getEmailBrand();
  const subject = fillVars(r.tpl.subject, vars);
  const ctaText = r.tpl.ctaText.trim();
  const ctaUrl = fillVars(r.tpl.ctaUrl, vars).trim();
  const html = renderRichEmail({
    body: fillVars(r.tpl.body, vars),
    brand,
    cta: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : undefined,
    imageUrl: r.tpl.imageUrl,
    buttonColor: r.tpl.buttonColor,
  });
  return { subject, html, enabled: r.tpl.enabled };
}

/** Render an unsaved draft (for the editor's live preview). */
export async function renderDraft(
  draft: Pick<EmailTemplate, "subject" | "body" | "ctaText" | "ctaUrl" | "imageUrl"> & { buttonColor?: string },
  vars: Record<string, string | undefined>,
): Promise<{ subject: string; html: string }> {
  const brand = await getEmailBrand();
  const ctaText = (draft.ctaText ?? "").trim();
  const ctaUrl = fillVars(draft.ctaUrl ?? "", vars).trim();
  return {
    subject: fillVars(draft.subject ?? "", vars),
    html: renderRichEmail({
      body: fillVars(draft.body ?? "", vars),
      brand,
      cta: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : undefined,
      imageUrl: draft.imageUrl,
      buttonColor: draft.buttonColor,
    }),
  };
}

/**
 * Render an ad-hoc branded email (broadcasts, invites) in the same shell as
 * lifecycle emails, so everything the store sends looks consistent.
 */
export async function renderBrandedEmail(
  subject: string,
  body: string,
  vars: Record<string, string | undefined> = {},
  opts?: { cta?: { text: string; url: string }; imageUrl?: string; buttonColor?: string },
): Promise<{ subject: string; html: string }> {
  const brand = await getEmailBrand();
  const ctaText = opts?.cta?.text?.trim();
  const ctaUrl = opts?.cta?.url ? fillVars(opts.cta.url, vars).trim() : "";
  return {
    subject: fillVars(subject, vars),
    html: renderRichEmail({
      body: fillVars(body, vars),
      brand,
      cta: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : undefined,
      imageUrl: opts?.imageUrl,
      buttonColor: opts?.buttonColor,
    }),
  };
}

/**
 * Send a broadcast to many recipients using the branded shell, personalizing
 * {{name}}/{{code}}/{{earnings}}/{{link}} per recipient. Brand is fetched once.
 */
export async function sendRichBroadcast(
  recipients: { email: string; name?: string; code?: string; earnings?: string; link?: string }[],
  subject: string,
  body: string,
  opts?: { cta?: { text: string; url: string }; imageUrl?: string; buttonColor?: string },
): Promise<{ sent: number; failed: number }> {
  const brand = await getEmailBrand();
  const ctaText = opts?.cta?.text?.trim();
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const vars = { name: r.name || "there", code: r.code, earnings: r.earnings, link: r.link };
    const ctaUrl = opts?.cta?.url ? fillVars(opts.cta.url, vars).trim() : "";
    try {
      await sendEmail(
        r.email,
        fillVars(subject, vars),
        renderRichEmail({
          body: fillVars(body, vars),
          brand,
          cta: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : undefined,
          imageUrl: opts?.imageUrl,
          buttonColor: opts?.buttonColor,
        }),
      );
      sent++;
    } catch {
      failed++;
    }
  }
  return { sent, failed };
}

/**
 * The single entry point for sending a lifecycle email. Honours the admin's
 * on/off switch and content overrides. Never throws — returns true only when a
 * message was actually handed to Resend.
 */
export async function dispatchEmail(
  key: string,
  to: string,
  vars: Record<string, string | undefined> = {},
): Promise<boolean> {
  if (!to) return false;
  try {
    const rendered = await renderEmailForType(key, vars);
    if (!rendered) return false;
    if (!rendered.enabled) return false; // admin switched this email off
    const res: any = await sendEmail(to, rendered.subject, rendered.html);
    return !res?.skipped;
  } catch (e) {
    console.error(`[email-center] dispatch "${key}" failed:`, e);
    return false;
  }
}
