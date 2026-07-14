"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affiliates,
  users,
  programs,
  groups,
  promotions,
  commissions,
  discountCodes,
  payouts,
  payoutItems,
  messages,
  inviteTemplates,
  campaigns,
  affiliateCampaigns,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { createDiscountForAffiliate } from "@/lib/discounts";
import { createPayoutBatch } from "@/lib/paypal";
import { sendBroadcast as sendEmails, sendEmail, renderTemplate, wrapEmail } from "@/lib/email";

export type ActionResult = { ok: boolean; message: string };

async function assertAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") throw new Error("Unauthorized");
}

function revalAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/payouts");
}

// ---------- Affiliates ----------

export async function approveAffiliate(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) });
  if (!aff) return { ok: false, message: "Affiliate not found." };

  await db.update(affiliates).set({ status: "approved" }).where(eq(affiliates.id, id));

  // Issue a discount code if one doesn't exist yet.
  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, id) });
  if (!existing) {
    const program = aff.programId
      ? await db.query.programs.findFirst({ where: eq(programs.id, aff.programId) })
      : await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
    const percent = program && program.commissionType === "percent" ? Number(program.commissionValue) : 15;
    const code = `${aff.refCode}${percent}`.toUpperCase();

    let shopifyDiscountId: string | null = null;
    if (process.env.SHOPIFY_ADMIN_TOKEN) {
      try {
        shopifyDiscountId = await createDiscountForAffiliate(code, percent);
      } catch (e) {
        console.error("[approveAffiliate] Shopify code creation failed:", e);
      }
    }
    await db
      .insert(discountCodes)
      .values({ affiliateId: id, code, percentage: percent.toString(), shopifyDiscountId, active: true })
      .onConflictDoNothing();
  }

  revalAdmin();
  return { ok: true, message: "Affiliate approved and code issued." };
}

export async function setAffiliateStatus(
  id: string,
  status: "approved" | "rejected" | "suspended" | "pending",
): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  if (status === "approved") return approveAffiliate(id);
  await db.update(affiliates).set({ status }).where(eq(affiliates.id, id));
  revalAdmin();
  return { ok: true, message: `Affiliate ${status}.` };
}

export async function assignProgram(affiliateId: string, programId: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(affiliates).set({ programId }).where(eq(affiliates.id, affiliateId));
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  return { ok: true, message: "Program reassigned." };
}

// ---------- Commissions ----------

export async function approveCommissions(ids: string[]): Promise<ActionResult> {
  await assertAdmin();
  if (!db || ids.length === 0) return { ok: false, message: "Nothing to approve." };
  // Only pending/reversed commissions can be approved — never touch paid ones.
  const rows = await db
    .update(commissions)
    .set({ status: "approved" })
    .where(and(inArray(commissions.id, ids), inArray(commissions.status, ["pending", "reversed"])))
    .returning({ id: commissions.id });
  revalAdmin();
  return { ok: true, message: `${rows.length} commission(s) approved.` };
}

export async function reverseCommissions(ids: string[]): Promise<ActionResult> {
  await assertAdmin();
  if (!db || ids.length === 0) return { ok: false, message: "Nothing to reverse." };
  // Only pending/approved commissions can be reversed — paid ones are settled.
  const rows = await db
    .update(commissions)
    .set({ status: "reversed" })
    .where(and(inArray(commissions.id, ids), inArray(commissions.status, ["pending", "approved"])))
    .returning({ id: commissions.id });
  revalAdmin();
  return { ok: true, message: `${rows.length} commission(s) reversed.` };
}

// ---------- Programs ----------

const programSchema = z.object({
  name: z.string().min(2),
  commissionType: z.enum(["percent", "flat"]),
  commissionValue: z.coerce.number().positive(),
  cookieWindowDays: z.coerce.number().int().positive().default(30),
  holdDays: z.coerce.number().int().nonnegative().default(30),
  newCustomerOnly: z.coerce.boolean().default(false),
});

export async function createProgram(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const count = await db.select({ c: sql<number>`count(*)` }).from(programs);
  await db.insert(programs).values({
    name: d.name,
    commissionType: d.commissionType,
    commissionValue: d.commissionValue.toString(),
    cookieWindowDays: d.cookieWindowDays,
    holdDays: d.holdDays,
    newCustomerOnly: d.newCustomerOnly,
    isDefault: Number(count[0]?.c ?? 0) === 0,
  });
  revalidatePath("/admin/programs");
  return { ok: true, message: "Program created." };
}

export async function setDefaultProgram(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(programs).set({ isDefault: false });
  await db.update(programs).set({ isDefault: true }).where(eq(programs.id, id));
  revalidatePath("/admin/programs");
  return { ok: true, message: "Default program updated." };
}

// ---------- Groups ----------

export async function createGroup(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z.object({ name: z.string().min(2), description: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a group name." };
  await db.insert(groups).values({ name: parsed.data.name, description: parsed.data.description || null });
  revalidatePath("/admin/groups");
  return { ok: true, message: "Group created." };
}

export async function updateGroup(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z.object({ name: z.string().min(2), description: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a group name." };
  await db
    .update(groups)
    .set({ name: parsed.data.name, description: parsed.data.description || null })
    .where(eq(groups.id, id));
  revalidatePath(`/admin/groups/${id}`);
  revalidatePath("/admin/groups");
  return { ok: true, message: "Group updated." };
}

export async function deleteGroup(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  // Detach members first (their group_id references this group).
  await db.update(affiliates).set({ groupId: null }).where(eq(affiliates.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
  revalidatePath("/admin/groups");
  return { ok: true, message: "Group deleted." };
}

export async function setAffiliateGroup(affiliateId: string, groupId: string | null): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(affiliates).set({ groupId }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/admin/groups");
  if (groupId) revalidatePath(`/admin/groups/${groupId}`);
  return { ok: true, message: groupId ? "Added to group." : "Removed from group." };
}

// ---------- Promotions ----------

export async function createPromotion(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      name: z.string().min(2),
      bonusType: z.enum(["percent", "flat"]).default("percent"),
      bonusValue: z.coerce.number().positive(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  await db.insert(promotions).values({
    name: d.name,
    bonusType: d.bonusType,
    bonusValue: d.bonusValue.toString(),
    startsAt: d.startsAt ? new Date(d.startsAt) : new Date(),
    endsAt: d.endsAt ? new Date(d.endsAt) : new Date(Date.now() + 14 * 86_400_000),
  });
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Promotion launched." };
}

// ---------- Broadcast ----------

export async function sendBroadcast(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({ subject: z.string().min(1), body: z.string().min(1), status: z.array(z.string()).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Add a subject and message." };
  const { subject, body, status } = parsed.data;

  const recipients = await db
    .select({ email: users.email, name: users.name })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(status?.length ? inArray(affiliates.status, status as any) : eq(affiliates.status, "approved"));

  await db.insert(messages).values({
    subject,
    body,
    channel: "email",
    audience: { status: status ?? ["approved"] },
    sentAt: new Date(),
  });

  if (process.env.RESEND_API_KEY) {
    await sendEmails(
      recipients.filter((r) => r.email).map((r) => ({ email: r.email!, name: r.name ?? undefined })),
      subject,
      body,
    );
  }

  revalidatePath("/admin/messages");
  return { ok: true, message: `Broadcast sent to ${recipients.length} affiliate(s).` };
}

// ---------- Bulk discount codes ----------

export async function bulkCreateDiscounts(percent: number, prefix = ""): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const approved = await db.query.affiliates.findMany({ where: eq(affiliates.status, "approved") });
  let created = 0;
  for (const aff of approved) {
    const code = `${prefix}${aff.refCode}${percent}`.toUpperCase();
    const exists = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code) });
    if (exists) continue;
    let shopifyDiscountId: string | null = null;
    if (process.env.SHOPIFY_ADMIN_TOKEN) {
      try {
        shopifyDiscountId = await createDiscountForAffiliate(code, percent);
      } catch (e) {
        console.error("[bulkCreateDiscounts]", code, e);
      }
    }
    await db
      .insert(discountCodes)
      .values({ affiliateId: aff.id, code, percentage: percent.toString(), shopifyDiscountId, active: true })
      .onConflictDoNothing();
    created++;
  }
  revalidatePath("/admin/codes");
  return { ok: true, message: `Created ${created} discount code(s).` };
}

// ---------- Payouts ----------

export async function runPayout(): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };

  // Build the payable set: approved affiliates over their program minimum with a PayPal email.
  const rows = await db
    .select({
      affiliateId: affiliates.id,
      paypalEmail: affiliates.paypalEmail,
      minimum: programs.payoutMinimum,
      total: sql<string>`coalesce(sum(${commissions.amount}),0)`,
    })
    .from(commissions)
    .innerJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(programs, eq(affiliates.programId, programs.id))
    .where(and(eq(commissions.status, "approved"), eq(affiliates.status, "approved")))
    .groupBy(affiliates.id, affiliates.paypalEmail, programs.payoutMinimum);

  const payable = rows.filter((r) => r.paypalEmail && Number(r.total) >= Number(r.minimum ?? 0) && Number(r.total) > 0);
  if (payable.length === 0) return { ok: false, message: "Nothing payable right now." };

  const total = payable.reduce((s, r) => s + Number(r.total), 0);
  const senderBatchId = `AFF-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;

  const [batch] = await db
    .insert(payouts)
    .values({
      senderBatchId,
      status: "processing",
      totalAmount: total.toFixed(2),
      affiliateCount: payable.length,
    })
    .returning();

  for (const r of payable) {
    await db.insert(payoutItems).values({
      payoutId: batch.id,
      affiliateId: r.affiliateId,
      amount: Number(r.total).toFixed(2),
      transactionStatus: "PENDING",
    });
  }

  let status: "processing" | "success" = "processing";
  if (process.env.PAYPAL_CLIENT_ID) {
    try {
      const items = await db.query.payoutItems.findMany({ where: eq(payoutItems.payoutId, batch.id) });
      const recipients = payable.map((r) => {
        const item = items.find((i) => i.affiliateId === r.affiliateId)!;
        return { senderItemId: item.id, amount: Number(r.total).toFixed(2), email: r.paypalEmail! };
      });
      const res = await createPayoutBatch(senderBatchId, recipients);
      await db.update(payouts).set({ paypalBatchId: res.payoutBatchId ?? null }).where(eq(payouts.id, batch.id));
    } catch (e) {
      console.error("[runPayout] PayPal error:", e);
      await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, batch.id));
      return { ok: false, message: "PayPal batch failed — see logs." };
    }
  } else {
    // No PayPal configured (sandbox/dev): mark the batch complete.
    status = "success";
    await db.update(payouts).set({ status: "success" }).where(eq(payouts.id, batch.id));
    await db.update(payoutItems).set({ transactionStatus: "SUCCESS" }).where(eq(payoutItems.payoutId, batch.id));
  }

  // Mark those affiliates' approved commissions as paid and link the batch.
  for (const r of payable) {
    await db
      .update(commissions)
      .set({ status: "paid", payoutId: batch.id })
      .where(and(eq(commissions.affiliateId, r.affiliateId), eq(commissions.status, "approved")));
  }

  revalAdmin();
  return {
    ok: true,
    message:
      status === "success"
        ? `Paid ${payable.length} affiliate(s) — $${total.toFixed(2)}.`
        : `PayPal batch submitted for ${payable.length} affiliate(s).`,
  };
}

// ---------- Invites ----------

const APP_URL = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "";

function slugCode(s: string) {
  return (s.split(/[\s@]+/)[0] || "PARTNER").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "PARTNER";
}
async function uniqueRefCode(base: string) {
  let code = base;
  let n = 1;
  while (await db!.query.affiliates.findFirst({ where: eq(affiliates.refCode, code) })) code = `${base}${n++}`;
  return code;
}

async function defaultTemplate() {
  return (
    (await db!.query.inviteTemplates.findFirst({ where: eq(inviteTemplates.isDefault, true) })) ??
    (await db!.query.inviteTemplates.findFirst({}))
  );
}

interface InviteOutcome {
  email: string;
  ok: boolean;
  emailed: boolean;
  tempPassword?: string;
  code?: string;
  error?: string;
}

async function createAndInvite(
  name: string,
  email: string,
  templateId?: string,
  existingCode?: string,
): Promise<InviteOutcome> {
  email = email.toLowerCase().trim();
  const existing = await db!.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { email, ok: false, emailed: false, error: "Already exists" };

  const tempPassword = crypto.randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const [user] = await db!
    .insert(users)
    .values({ email, name: name || email, passwordHash, role: "affiliate" })
    .returning();

  const program = await db!.query.programs.findFirst({ where: eq(programs.isDefault, true) });

  // Preserve an imported code (e.g. from ReferralCandy) so existing links keep working.
  const cleanCode = existingCode ? existingCode.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  const refBase = cleanCode || slugCode(name || email);
  const refCode = await uniqueRefCode(refBase);
  const percent = program && program.commissionType === "percent" ? Number(program.commissionValue) : 15;
  const code = cleanCode || `${refCode}${percent}`.toUpperCase();

  const [aff] = await db!
    .insert(affiliates)
    .values({ userId: user.id, status: "approved", refCode, paypalEmail: null, programId: program?.id ?? null })
    .returning();

  // Issue the discount code (create in Shopify only if it's a freshly generated one;
  // imported codes are assumed to already exist in the store).
  let shopifyDiscountId: string | null = null;
  if (!existingCode && process.env.SHOPIFY_ADMIN_TOKEN) {
    try {
      shopifyDiscountId = await createDiscountForAffiliate(code, percent);
    } catch (e) {
      console.error("[invite] shopify code:", e);
    }
  }
  await db!
    .insert(discountCodes)
    .values({ affiliateId: aff.id, code, percentage: percent.toString(), shopifyDiscountId, active: true })
    .onConflictDoNothing();

  // Send the invite email using the chosen (or default) template.
  let emailed = false;
  const tpl = templateId
    ? await db!.query.inviteTemplates.findFirst({ where: eq(inviteTemplates.id, templateId) })
    : await defaultTemplate();
  if (tpl && process.env.RESEND_API_KEY) {
    const vars = { name: name || "there", code, loginUrl: `${APP_URL}/login`, link: `${APP_URL}/api/track?ref=${refCode}`, tempPassword };
    try {
      await sendEmail(email, renderTemplate(tpl.subject, vars), wrapEmail(renderTemplate(tpl.body, vars)));
      emailed = true;
    } catch (e) {
      console.error("[invite] email:", e);
    }
  }

  return { email, ok: true, emailed, tempPassword, code };
}

export async function inviteAffiliate(input: unknown): Promise<ActionResult & { tempPassword?: string; emailed?: boolean }> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({ name: z.string().optional(), email: z.string().email(), code: z.string().optional(), templateId: z.string().optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a valid email." };
  const res = await createAndInvite(parsed.data.name ?? "", parsed.data.email, parsed.data.templateId, parsed.data.code);
  revalAdmin();
  if (!res.ok) return { ok: false, message: `${res.email}: ${res.error}` };
  return {
    ok: true,
    emailed: res.emailed,
    tempPassword: res.emailed ? undefined : res.tempPassword,
    message: res.emailed
      ? `Invite emailed to ${res.email}.`
      : `Created ${res.email}. Email not sent (Resend not configured) — temp password: ${res.tempPassword}`,
  };
}

export async function bulkInviteAffiliates(
  rows: { name?: string; email: string; code?: string }[],
  templateId?: string,
): Promise<ActionResult & { created: number; emailed: number; skipped: number }> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured.", created: 0, emailed: 0, skipped: 0 };
  const clean = (rows ?? []).filter((r) => /.+@.+\..+/.test(r.email ?? ""));
  let created = 0,
    emailed = 0,
    skipped = 0;
  for (const r of clean) {
    const res = await createAndInvite(r.name ?? "", r.email, templateId, r.code);
    if (res.ok) {
      created++;
      if (res.emailed) emailed++;
    } else skipped++;
  }
  revalAdmin();
  return {
    ok: created > 0,
    created,
    emailed,
    skipped,
    message: `Imported ${created} affiliate(s)${emailed ? `, ${emailed} emailed` : ""}${skipped ? `, ${skipped} skipped (already exist / invalid)` : ""}.`,
  };
}

/** Send (or re-send) a portal invite to affiliates that already exist —
 *  resets a temp password and emails their login + code + link. */
export async function sendPortalInvite(
  affiliateIds: string[],
  templateId?: string,
): Promise<ActionResult & { emailed: number }> {
  await assertAdmin();
  if (!db || affiliateIds.length === 0) return { ok: false, message: "No affiliates selected.", emailed: 0 };

  const tpl = templateId
    ? await db.query.inviteTemplates.findFirst({ where: eq(inviteTemplates.id, templateId) })
    : await defaultTemplate();

  let emailed = 0;
  let processed = 0;
  for (const id of affiliateIds) {
    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) });
    if (!aff) continue;
    const user = await db.query.users.findFirst({ where: eq(users.id, aff.userId) });
    if (!user) continue;
    const codeRow = await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, id) });

    // Reset a temp password so they can log in from the invite.
    const tempPassword = crypto.randomBytes(6).toString("base64url");
    await db.update(users).set({ passwordHash: await bcrypt.hash(tempPassword, 10) }).where(eq(users.id, user.id));
    processed++;

    if (tpl && process.env.RESEND_API_KEY) {
      const vars = {
        name: user.name ?? "there",
        code: codeRow?.code ?? aff.refCode,
        loginUrl: `${APP_URL}/login`,
        link: `${APP_URL}/api/track?ref=${aff.refCode}`,
        tempPassword,
      };
      try {
        await sendEmail(user.email, renderTemplate(tpl.subject, vars), wrapEmail(renderTemplate(tpl.body, vars)));
        emailed++;
      } catch (e) {
        console.error("[sendPortalInvite]", user.email, e);
      }
    }
  }

  revalAdmin();
  return {
    ok: processed > 0,
    emailed,
    message:
      emailed > 0
        ? `Invite sent to ${emailed} affiliate(s).`
        : `Reset access for ${processed} affiliate(s). Connect Resend (RESEND_API_KEY) to email invites automatically.`,
  };
}

// ---------- Invite templates ----------

const tplSchema = z.object({ name: z.string().min(2), subject: z.string().min(1), body: z.string().min(1) });

export async function createInviteTemplate(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = tplSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const count = await db.select({ c: sql<number>`count(*)` }).from(inviteTemplates);
  await db.insert(inviteTemplates).values({ ...parsed.data, isDefault: Number(count[0]?.c ?? 0) === 0 });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template created." };
}

export async function updateInviteTemplate(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = tplSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  await db.update(inviteTemplates).set(parsed.data).where(eq(inviteTemplates.id, id));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template updated." };
}

export async function deleteInviteTemplate(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.delete(inviteTemplates).where(eq(inviteTemplates.id, id));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template deleted." };
}

export async function setDefaultInviteTemplate(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(inviteTemplates).set({ isDefault: false });
  await db.update(inviteTemplates).set({ isDefault: true }).where(eq(inviteTemplates.id, id));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Default template set." };
}

// ---------- Campaigns ----------

const campaignSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["affiliate", "referral"]),
  description: z.string().optional(),
  codePrefix: z.string().optional(),
  rewardType: z.enum(["percent", "flat"]).default("percent"),
  rewardValue: z.coerce.number().nonnegative().default(0),
  friendRewardType: z.enum(["percent", "flat"]).default("percent"),
  friendRewardValue: z.coerce.number().nonnegative().default(0),
});

export async function createCampaign(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  await db.insert(campaigns).values({
    name: d.name,
    type: d.type,
    description: d.description || null,
    codePrefix: d.codePrefix ? d.codePrefix.toUpperCase() : null,
    rewardType: d.rewardType,
    rewardValue: d.rewardValue.toString(),
    friendRewardType: d.friendRewardType,
    friendRewardValue: d.friendRewardValue.toString(),
  });
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `${d.type === "referral" ? "Referral" : "Affiliate"} campaign created.` };
}

export async function updateCampaign(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = campaignSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input." };
  const d = parsed.data;
  await db
    .update(campaigns)
    .set({
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
      ...(d.codePrefix !== undefined ? { codePrefix: d.codePrefix ? d.codePrefix.toUpperCase() : null } : {}),
      ...(d.rewardType !== undefined ? { rewardType: d.rewardType } : {}),
      ...(d.rewardValue !== undefined ? { rewardValue: d.rewardValue.toString() } : {}),
      ...(d.friendRewardType !== undefined ? { friendRewardType: d.friendRewardType } : {}),
      ...(d.friendRewardValue !== undefined ? { friendRewardValue: d.friendRewardValue.toString() } : {}),
    })
    .where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Campaign updated." };
}

export async function setCampaignStatus(id: string, status: "active" | "paused" | "ended"): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `Campaign ${status}.` };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.delete(affiliateCampaigns).where(eq(affiliateCampaigns.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Campaign deleted." };
}

export async function assignAffiliateToCampaign(affiliateId: string, campaignId: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const existing = await db.query.affiliateCampaigns.findFirst({
    where: and(eq(affiliateCampaigns.affiliateId, affiliateId), eq(affiliateCampaigns.campaignId, campaignId)),
  });
  if (!existing) await db.insert(affiliateCampaigns).values({ affiliateId, campaignId });
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Added to campaign." };
}

export async function removeAffiliateFromCampaign(affiliateId: string, campaignId: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db
    .delete(affiliateCampaigns)
    .where(and(eq(affiliateCampaigns.affiliateId, affiliateId), eq(affiliateCampaigns.campaignId, campaignId)));
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Removed from campaign." };
}

// ---------- Edit an affiliate's discount code ----------

export async function updateAffiliateCode(affiliateId: string, rawCode: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 3) return { ok: false, message: "Code must be at least 3 characters." };

  // Ensure uniqueness across all codes.
  const clash = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code) });
  if (clash && clash.affiliateId !== affiliateId) return { ok: false, message: "That code is already taken." };

  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, affiliateId) });
  if (existing) {
    await db.update(discountCodes).set({ code }).where(eq(discountCodes.id, existing.id));
  } else {
    await db.insert(discountCodes).values({ affiliateId, code, active: true });
  }
  // Keep the ref code aligned so links match the coupon.
  await db.update(affiliates).set({ refCode: code }).where(eq(affiliates.id, affiliateId)).catch(() => {});
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  return { ok: true, message: `Code updated to ${code}.` };
}
