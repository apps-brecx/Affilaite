"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import {
  emailTypeByKey,
  getEmailTemplate,
  defaultTemplate,
  renderEmailForType,
  renderDraft,
  type EmailTemplate,
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

const patchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(4000).optional(),
  ctaText: z.string().max(60).optional(),
  ctaUrl: z.string().max(500).optional(),
  imageUrl: z.string().max(1000).optional(),
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
  try {
    const res: any = await sendEmail(address, `[TEST] ${rendered.subject}`, rendered.html);
    if (res?.skipped) return { ok: false, message: "Connect Resend in Settings → Integrations first." };
    return { ok: true, message: `Test sent to ${address}.` };
  } catch (e: any) {
    return { ok: false, message: `Send failed: ${e?.message ?? "unknown error"}` };
  }
}

/** Server-rendered HTML preview of an unsaved draft (uses sample vars). */
export async function previewEmail(
  key: string,
  draft: Pick<EmailTemplate, "subject" | "body" | "ctaText" | "ctaUrl" | "imageUrl">,
): Promise<{ subject: string; html: string } | null> {
  await assertAdmin();
  if (!emailTypeByKey(key)) return null;
  return renderDraft(draft, SAMPLE_VARS);
}
