"use server";

import crypto from "crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, affiliates, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  emailTypeByKey,
  getEmailTemplate,
  defaultTemplate,
  renderEmailForType,
  renderDraft,
  renderBrandedEmail,
  sendRichBroadcast,
  getEmailBrand,
  listCustomEmails,
  getCustomEmail,
  writeCustomEmails,
  type EmailTemplate,
  type EmailBrand,
  type CustomEmail,
} from "@/lib/email-center";

type Result = { ok: boolean; message: string };

async function assertAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") throw new Error("Unauthorized");
}

const PATH = "/admin/notifications";

/** Sample merge values so previews/tests read like a real email. */
const SAMPLE_VARS: Record<string, string> = {
  name: "Jordan",
  code: "JORDAN15",
  amount: "12.50",
  currency: "USD",
  earnings: "$148.20",
  loginUrl: "https://sipfluence.example.com/login",
  dashboardUrl: "https://sipfluence.example.com/dashboard",
  link: "https://sipfluence.example.com/reset-password?token=demo",
};

const hexOpt = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #FF5C9E.").optional().or(z.literal(""));

// ---------- Built-in lifecycle templates ----------

const patchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
  ctaText: z.string().max(60).optional(),
  ctaUrl: z.string().max(500).optional(),
  imageUrl: z.string().max(1000).optional(),
  buttonColor: hexOpt,
});

export async function saveEmailTemplate(input: unknown): Promise<Result> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = patchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const { key, ...patch } = parsed.data;
  const type = emailTypeByKey(key);
  if (!type) return { ok: false, message: "Unknown email type." };

  // Guard: security emails must keep their action link.
  if (key === "password_reset" && patch.body !== undefined && !patch.body.includes("{{link}}") && (patch.ctaUrl ?? "").indexOf("{{link}}") === -1) {
    return { ok: false, message: "Keep {{link}} in the body or button — it's the reset link." };
  }

  const current = (await getEmailTemplate(key))?.tpl ?? defaultTemplate(type);
  const next: EmailTemplate = {
    enabled: type.togglable ? patch.enabled ?? current.enabled : true,
    subject: (patch.subject ?? current.subject).trim() || type.defaultSubject,
    body: patch.body ?? current.body,
    ctaText: patch.ctaText ?? current.ctaText,
    ctaUrl: patch.ctaUrl ?? current.ctaUrl,
    imageUrl: (patch.imageUrl ?? current.imageUrl).trim(),
    buttonColor: (patch.buttonColor ?? current.buttonColor).trim(),
  };

  await db
    .insert(appSettings)
    .values({ key: `email:${key}`, value: JSON.stringify(next) })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(next), updatedAt: new Date() } });

  revalidatePath(PATH);
  return { ok: true, message: "Saved." };
}

export async function toggleEmailTemplate(key: string, enabled: boolean): Promise<Result> {
  return saveEmailTemplate({ key, enabled });
}

export async function resetEmailTemplate(key: string): Promise<Result> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  if (!emailTypeByKey(key)) return { ok: false, message: "Unknown email type." };
  await db.delete(appSettings).where(eq(appSettings.key, `email:${key}`));
  revalidatePath(PATH);
  return { ok: true, message: "Reset to the default." };
}

export async function sendTestEmail(key: string, to: string): Promise<Result> {
  await assertAdmin();
  const address = (to ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { ok: false, message: "Enter a valid email address." };
  const rendered = await renderEmailForType(key, SAMPLE_VARS);
  if (!rendered) return { ok: false, message: "Unknown email type." };
  return actuallySend(address, rendered.subject, rendered.html);
}

/** Server-rendered HTML preview of an unsaved draft (uses sample vars). */
export async function previewEmail(
  key: string,
  draft: Pick<EmailTemplate, "subject" | "body" | "ctaText" | "ctaUrl" | "imageUrl" | "buttonColor">,
): Promise<{ subject: string; html: string } | null> {
  await assertAdmin();
  return renderDraft(draft, SAMPLE_VARS);
}

// ---------- Global email branding ----------

const brandSchema = z.object({
  logoText: z.string().max(60).optional(),
  logoUrl: z.string().max(1000).optional(),
  primaryColor: hexOpt,
  buttonColor: hexOpt,
  footerText: z.string().max(600).optional(),
});

export async function saveEmailBrand(input: unknown): Promise<Result> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = brandSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid branding." };
  const current = await getEmailBrand();
  const p = parsed.data;
  const next: EmailBrand = {
    logoText: (p.logoText ?? current.logoText).trim() || "Sipfluence",
    logoUrl: (p.logoUrl ?? current.logoUrl).trim(),
    primaryColor: (p.primaryColor ?? current.primaryColor).trim() || "#FF5C9E",
    buttonColor: (p.buttonColor ?? current.buttonColor).trim() || "#FF5C9E",
    footerText: p.footerText ?? current.footerText,
  };
  await db
    .insert(appSettings)
    .values({ key: "email_brand", value: JSON.stringify(next) })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: JSON.stringify(next), updatedAt: new Date() } });
  revalidatePath(PATH);
  return { ok: true, message: "Branding saved — it applies to every email." };
}

// ---------- Custom emails ----------

const customSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Give it a name.").max(80),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
  ctaText: z.string().max(60).optional(),
  ctaUrl: z.string().max(500).optional(),
  imageUrl: z.string().max(1000).optional(),
  buttonColor: hexOpt,
});

export async function saveCustomEmail(input: unknown): Promise<Result & { id?: string }> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = customSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid email." };
  const d = parsed.data;
  const list = await listCustomEmails();
  const id = d.id ?? crypto.randomUUID();
  const item: CustomEmail = {
    id,
    name: d.name.trim(),
    subject: (d.subject ?? "").trim(),
    body: d.body ?? "",
    ctaText: (d.ctaText ?? "").trim(),
    ctaUrl: (d.ctaUrl ?? "").trim(),
    imageUrl: (d.imageUrl ?? "").trim(),
    buttonColor: (d.buttonColor ?? "").trim(),
  };
  const idx = list.findIndex((c) => c.id === id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
  await writeCustomEmails(list);
  revalidatePath(PATH);
  return { ok: true, message: "Saved.", id };
}

export async function deleteCustomEmail(id: string): Promise<Result> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const list = (await listCustomEmails()).filter((c) => c.id !== id);
  await writeCustomEmails(list);
  revalidatePath(PATH);
  return { ok: true, message: "Deleted." };
}

export async function sendTestCustomEmail(id: string, to: string): Promise<Result> {
  await assertAdmin();
  const address = (to ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { ok: false, message: "Enter a valid email address." };
  const c = await getCustomEmail(id);
  if (!c) return { ok: false, message: "Email not found." };
  const r = await renderBrandedEmail(c.subject, c.body, SAMPLE_VARS, {
    cta: c.ctaText && c.ctaUrl ? { text: c.ctaText, url: c.ctaUrl } : undefined,
    imageUrl: c.imageUrl,
    buttonColor: c.buttonColor,
  });
  return actuallySend(address, r.subject, r.html);
}

/** Send a custom email to a segment of affiliates. */
export async function sendCustomEmailToAudience(id: string, audience: "approved" | "all"): Promise<Result> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const c = await getCustomEmail(id);
  if (!c) return { ok: false, message: "Email not found." };
  if (!c.subject.trim() || !c.body.trim()) return { ok: false, message: "Add a subject and message first." };

  const statuses = audience === "all" ? ["approved", "pending", "suspended"] : ["approved"];
  const rows = await db
    .select({ email: users.email, name: users.name, prefs: affiliates.notificationPrefs })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(inArray(affiliates.status, statuses as any));

  const recipients = rows
    .filter((r) => r.email && (r.prefs as Record<string, boolean> | null)?.programUpdates !== false)
    .map((r) => ({ email: r.email!, name: r.name ?? undefined }));
  if (!recipients.length) return { ok: false, message: "No opted-in recipients in that segment." };

  const { sent, failed } = await sendRichBroadcast(recipients, c.subject, c.body, {
    cta: c.ctaText && c.ctaUrl ? { text: c.ctaText, url: c.ctaUrl } : undefined,
    imageUrl: c.imageUrl,
    buttonColor: c.buttonColor,
  });
  return { ok: sent > 0, message: sent > 0 ? `Sent to ${sent} partner(s)${failed ? `, ${failed} failed` : ""}.` : "Nothing sent — is Resend connected?" };
}

// ---------- shared ----------

async function actuallySend(address: string, subject: string, html: string): Promise<Result> {
  try {
    const res: any = await sendEmail(address, `[TEST] ${subject}`, html);
    if (res?.skipped) return { ok: false, message: "Connect Resend in Settings → Integrations first." };
    return { ok: true, message: `Test sent to ${address}.` };
  } catch (e: any) {
    return { ok: false, message: `Send failed: ${e?.message ?? "unknown error"}` };
  }
}
