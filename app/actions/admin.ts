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
  appSettings,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  createDiscountForAffiliate,
  updateDiscountInShopify,
  deleteDiscountInShopify,
  setDiscountActiveInShopify,
} from "@/lib/discounts";
import { createPayoutBatch } from "@/lib/paypal";
import { sendBroadcast as sendEmails, sendEmail, renderTemplate, wrapEmail } from "@/lib/email";
import { defaultConfig } from "@/lib/campaign-config";
import { shopifyReady, paypalReady, emailReady, encryptSecret } from "@/lib/integrations";
import { shopifyGraphQL } from "@/lib/shopify";
import { getEarningsSeries } from "@/lib/queries";
import { notify } from "@/lib/notifications";
import type { TimePoint } from "@/lib/types";

type EarningsRange = "today" | "week" | "month" | "year" | "all";
const REVENUE_RANGE_DAYS: Record<EarningsRange, number> = { today: 1, week: 7, month: 30, year: 365, all: 3650 };

/** Program-wide affiliate-driven revenue series for a range (admin only). */
export async function getRevenueRange(range: EarningsRange): Promise<TimePoint[]> {
  await assertAdmin();
  return getEarningsSeries(REVENUE_RANGE_DAYS[range] ?? 30);
}

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
    if (await shopifyReady()) {
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

  await notify(
    id,
    "dashboard",
    "You're approved 🎉",
    "Your partner account is active — grab your link and start earning.",
    "/dashboard",
  );
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
    .returning({ id: commissions.id, affiliateId: commissions.affiliateId });
  const affIds = [...new Set(rows.map((r) => r.affiliateId).filter(Boolean))] as string[];
  for (const affiliateId of affIds) {
    await notify(
      affiliateId,
      "performance",
      "Commission approved",
      "New earnings cleared review and are on their way to payout.",
      "/performance",
    );
  }
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
      productId: z.string().optional(),
      productTitle: z.string().optional(),
      productImage: z.string().optional(),
      productUrl: z.string().optional(),
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
    productId: d.productId || null,
    productTitle: d.productTitle || null,
    productImage: d.productImage || null,
    productUrl: d.productUrl || null,
  });
  const approvedAffs = await db
    .select({ id: affiliates.id })
    .from(affiliates)
    .where(eq(affiliates.status, "approved"));
  await notify(
    approvedAffs.map((a) => a.id),
    "promotions",
    `New promotion: ${d.name}`,
    `Earn +${d.bonusValue}% bonus${d.productTitle ? ` — featuring ${d.productTitle}` : ""}.`,
    "/promotions",
  );
  revalidatePath("/admin/promotions");
  revalidatePath("/promotions");
  return { ok: true, message: "Promotion launched." };
}

// ---------- Broadcast ----------

export async function sendBroadcast(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      subject: z.string().min(1),
      body: z.string().min(1),
      status: z.array(z.string()).optional(),
      groupIds: z.array(z.string()).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Add a subject and message." };
  const { subject, body, status, groupIds } = parsed.data;

  // Target either specific groups or a set of statuses (default: approved).
  const where = groupIds?.length
    ? inArray(affiliates.groupId, groupIds as any)
    : status?.length
      ? inArray(affiliates.status, status as any)
      : eq(affiliates.status, "approved");

  const recipients = await db
    .select({ id: affiliates.id, email: users.email, name: users.name })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(where);

  await notify(
    recipients.map((r) => r.id),
    "community",
    subject,
    body.length > 140 ? `${body.slice(0, 140)}…` : body,
    "/community",
  );

  await db.insert(messages).values({
    subject,
    body,
    channel: "email",
    audience: groupIds?.length ? { groupIds } : { status: status ?? ["approved"] },
    sentAt: new Date(),
  });

  if (await emailReady()) {
    await sendEmails(
      recipients.filter((r) => r.email).map((r) => ({ email: r.email!, name: r.name ?? undefined })),
      subject,
      body,
    );
  }

  revalidatePath("/admin/messages");
  revalidatePath("/community");
  return { ok: true, message: `Message sent to ${recipients.length} affiliate(s).` };
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
    if (await shopifyReady()) {
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

/** Create one discount code for a single affiliate (also pushes to Shopify when connected). */
export async function createSingleDiscount(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      affiliateId: z.string().min(1),
      code: z.string().trim().min(3, "Code must be at least 3 characters").regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
      percentage: z.coerce.number().positive().max(100),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const code = parsed.data.code.toUpperCase();
  const { affiliateId, percentage } = parsed.data;

  const exists = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code) });
  if (exists) return { ok: false, message: `Code “${code}” already exists.` };

  let shopifyDiscountId: string | null = null;
  if (await shopifyReady()) {
    try {
      shopifyDiscountId = await createDiscountForAffiliate(code, percentage);
    } catch (e: any) {
      return { ok: false, message: `Shopify rejected the code: ${e.message}` };
    }
  }
  await db
    .insert(discountCodes)
    .values({ affiliateId, code, percentage: percentage.toString(), shopifyDiscountId, active: true });
  await notify(
    affiliateId,
    "links",
    "New discount code",
    `Your code ${code} (${percentage}% off) is ready to share.`,
    "/links",
  );
  revalidatePath("/admin/codes");
  return {
    ok: true,
    message: shopifyDiscountId ? `Code “${code}” created in Shopify.` : `Code “${code}” saved (Shopify not connected).`,
  };
}

/** Change a code's text or percentage — syncs to Shopify if the code is linked. */
export async function updateDiscountCode(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      id: z.string().min(1),
      code: z.string().trim().min(3, "Code must be at least 3 characters").regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
      percentage: z.coerce.number().positive().max(100),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const code = parsed.data.code.toUpperCase();
  const { id, percentage } = parsed.data;

  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.id, id) });
  if (!existing) return { ok: false, message: "Code not found." };

  // Guard against colliding with another code.
  const clash = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code) });
  if (clash && clash.id !== id) return { ok: false, message: `Code “${code}” is already taken.` };

  if (existing.shopifyDiscountId) {
    try {
      await updateDiscountInShopify(existing.shopifyDiscountId, { code, value: percentage, valueType: "percent" });
    } catch (e: any) {
      return { ok: false, message: `Shopify update failed: ${e.message}` };
    }
  }
  await db
    .update(discountCodes)
    .set({ code, percentage: percentage.toString() })
    .where(eq(discountCodes.id, id));
  revalidatePath("/admin/codes");
  return { ok: true, message: `Code updated to “${code}”.` };
}

/** Enable or disable a code — deactivates in Shopify without deleting. */
export async function toggleDiscountCode(id: string, active: boolean): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.id, id) });
  if (!existing) return { ok: false, message: "Code not found." };
  if (existing.shopifyDiscountId) {
    try {
      await setDiscountActiveInShopify(existing.shopifyDiscountId, active);
    } catch (e: any) {
      return { ok: false, message: `Shopify sync failed: ${e.message}` };
    }
  }
  await db.update(discountCodes).set({ active }).where(eq(discountCodes.id, id));
  revalidatePath("/admin/codes");
  return { ok: true, message: active ? "Code activated." : "Code deactivated." };
}

/** Permanently delete a code — removes it from Shopify too. */
export async function deleteDiscountCode(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.id, id) });
  if (!existing) return { ok: false, message: "Code not found." };
  if (existing.shopifyDiscountId) {
    try {
      await deleteDiscountInShopify(existing.shopifyDiscountId);
    } catch (e: any) {
      return { ok: false, message: `Shopify delete failed: ${e.message}` };
    }
  }
  await db.delete(discountCodes).where(eq(discountCodes.id, id));
  revalidatePath("/admin/codes");
  return { ok: true, message: `Code “${existing.code}” deleted.` };
}

/** Push a local-only code up to Shopify (for codes created before Shopify was connected). */
export async function pushDiscountToShopify(id: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  if (!(await shopifyReady())) return { ok: false, message: "Connect Shopify first (Settings → Integrations)." };
  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.id, id) });
  if (!existing) return { ok: false, message: "Code not found." };
  if (existing.shopifyDiscountId) return { ok: false, message: "This code is already in Shopify." };
  try {
    const shopifyDiscountId = await createDiscountForAffiliate(existing.code, Number(existing.percentage ?? 0));
    await db.update(discountCodes).set({ shopifyDiscountId }).where(eq(discountCodes.id, id));
  } catch (e: any) {
    return { ok: false, message: `Shopify rejected the code: ${e.message}` };
  }
  revalidatePath("/admin/codes");
  return { ok: true, message: `Code “${existing.code}” is now live in Shopify.` };
}

// ---------- Payouts ----------

/** Pay a single affiliate a custom (ad-hoc) amount — a bonus or manual payout. */
export async function runCustomPayout(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({ affiliateId: z.string().min(1), amount: z.coerce.number().positive("Enter an amount") })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const { affiliateId, amount } = parsed.data;

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  if (!aff) return { ok: false, message: "Affiliate not found." };
  if (!aff.paypalEmail) return { ok: false, message: "This affiliate has no PayPal email on file." };

  const senderBatchId = `CUSTOM-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
  const [batch] = await db
    .insert(payouts)
    .values({ senderBatchId, status: "processing", totalAmount: amount.toFixed(2), affiliateCount: 1 })
    .returning();
  const [item] = await db
    .insert(payoutItems)
    .values({ payoutId: batch.id, affiliateId, amount: amount.toFixed(2), transactionStatus: "PENDING" })
    .returning();

  if (await paypalReady()) {
    try {
      const res = await createPayoutBatch(senderBatchId, [{ senderItemId: item.id, amount: amount.toFixed(2), email: aff.paypalEmail }]);
      await db.update(payouts).set({ paypalBatchId: res.payoutBatchId ?? null }).where(eq(payouts.id, batch.id));
    } catch (e) {
      console.error("[runCustomPayout] PayPal error:", e);
      await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, batch.id));
      return { ok: false, message: "PayPal payout failed — see logs." };
    }
  } else {
    await db.update(payouts).set({ status: "success" }).where(eq(payouts.id, batch.id));
    await db.update(payoutItems).set({ transactionStatus: "SUCCESS" }).where(eq(payoutItems.id, item.id));
  }

  await notify(
    affiliateId,
    "payouts",
    "Payout sent 💸",
    `A payout of $${amount.toFixed(2)} is on its way to your PayPal.`,
    "/payouts",
  );
  revalAdmin();
  return { ok: true, message: `Custom payout of $${amount.toFixed(2)} sent.` };
}

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
  if (await paypalReady()) {
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
    await notify(
      r.affiliateId,
      "payouts",
      "Payout sent 💸",
      `$${Number(r.total).toFixed(2)} is on its way to your PayPal.`,
      "/payouts",
    );
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
  if (!existingCode && (await shopifyReady())) {
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
  if (tpl && (await emailReady())) {
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

    if (tpl && (await emailReady())) {
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

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
async function uniqueSlug(base: string, excludeId?: string) {
  let slug = base || "campaign";
  let n = 1;
  while (true) {
    const existing = await db!.query.campaigns.findFirst({ where: eq(campaigns.slug, slug) });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

const campaignSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["affiliate", "referral"]),
  access: z.enum(["instant", "approval", "invite"]).default("approval"),
  slug: z.string().optional(),
  shortCode: z.string().optional(),
  destinationUrl: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  description: z.string().optional(),
  codePrefix: z.string().optional(),
  rewardType: z.enum(["percent", "flat"]).default("percent"),
  rewardValue: z.coerce.number().nonnegative().default(0),
  friendRewardType: z.enum(["percent", "flat"]).default("percent"),
  friendRewardValue: z.coerce.number().nonnegative().default(0),
});

export async function createCampaign(input: unknown): Promise<ActionResult & { id?: string }> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = campaignSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const slug = await uniqueSlug(slugify(d.slug || d.name));
  const defaultDest =
    (await db.query.appSettings.findFirst({ where: eq(appSettings.key, "default_destination_url") }))?.value ??
    "https://syruvia.com";

  // Seed the rich config from the quick-create fields.
  const config = defaultConfig();
  config.reward.kind = d.type === "referral" ? "coupon" : "coupon";
  config.reward.valueType = d.rewardType === "flat" ? "fixed" : "percent";
  config.reward.value = d.rewardValue;
  config.friend.valueType = d.friendRewardType === "flat" ? "fixed" : "percent";
  config.friend.value = d.friendRewardValue;

  const [row] = await db
    .insert(campaigns)
    .values({
      name: d.name,
      type: d.type,
      access: d.access,
      slug,
      shortCode: d.shortCode ? d.shortCode.toUpperCase() : null,
      codePrefix: d.shortCode ? d.shortCode.toUpperCase() : d.codePrefix ? d.codePrefix.toUpperCase() : null,
      destinationUrl: d.destinationUrl?.trim() || defaultDest,
      startsAt: d.startsAt ? new Date(d.startsAt) : new Date(),
      endsAt: d.endsAt ? new Date(d.endsAt) : null,
      description: d.description || null,
      config: config as any,
      rewardType: d.rewardType,
      rewardValue: d.rewardValue.toString(),
      friendRewardType: d.friendRewardType,
      friendRewardValue: d.friendRewardValue.toString(),
    })
    .returning({ id: campaigns.id });
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `${d.type === "referral" ? "Referral" : "Affiliate"} campaign created.`, id: row.id };
}

export async function updateCampaign(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = campaignSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid input." };
  const d = parsed.data;

  let slug: string | undefined;
  if (d.slug !== undefined) slug = await uniqueSlug(slugify(d.slug || d.name || "campaign"), id);

  await db
    .update(campaigns)
    .set({
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.access !== undefined ? { access: d.access } : {}),
      ...(slug !== undefined ? { slug } : {}),
      ...(d.shortCode !== undefined
        ? { shortCode: d.shortCode ? d.shortCode.toUpperCase() : null, codePrefix: d.shortCode ? d.shortCode.toUpperCase() : null }
        : {}),
      ...(d.destinationUrl !== undefined ? { destinationUrl: d.destinationUrl?.trim() || null } : {}),
      ...(d.startsAt !== undefined ? { startsAt: d.startsAt ? new Date(d.startsAt) : null } : {}),
      ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
      ...(d.description !== undefined ? { description: d.description || null } : {}),
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

export async function setSetting(key: string, value: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Setting saved." };
}

/** Save the full rewards & rules config for a campaign. */
export async function updateCampaignConfig(id: string, config: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  if (!config || typeof config !== "object") return { ok: false, message: "Invalid config." };
  await db.update(campaigns).set({ config: config as any }).where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  return { ok: true, message: "Rewards & rules saved." };
}

// ---------- Integrations (connect from the UI) ----------

async function writeSetting(key: string, value: string) {
  await db!
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}
// Only overwrite a secret when a new value is supplied — blank keeps the existing one.
async function writeSecret(key: string, value: string) {
  if (!value || value.trim() === "") return;
  await writeSetting(key, encryptSecret(value.trim()));
}

const INTEGRATION_KEYS: Record<string, string[]> = {
  shopify: ["int_shopify_domain", "int_shopify_version", "int_shopify_token", "int_shopify_secret"],
  paypal: ["int_paypal_base", "int_paypal_client_id", "int_paypal_client_secret"],
  email: ["int_email_from", "int_resend_key"],
};

export async function saveIntegration(service: string, fields: Record<string, string>): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  if (service === "shopify") {
    if (fields.domain !== undefined) await writeSetting("int_shopify_domain", fields.domain.trim());
    if (fields.version !== undefined) await writeSetting("int_shopify_version", fields.version.trim() || "2025-07");
    await writeSecret("int_shopify_token", fields.token ?? "");
    await writeSecret("int_shopify_secret", fields.apiSecret ?? "");
  } else if (service === "paypal") {
    if (fields.base !== undefined) await writeSetting("int_paypal_base", fields.base.trim());
    await writeSecret("int_paypal_client_id", fields.clientId ?? "");
    await writeSecret("int_paypal_client_secret", fields.clientSecret ?? "");
  } else if (service === "email") {
    if (fields.from !== undefined) await writeSetting("int_email_from", fields.from.trim());
    await writeSecret("int_resend_key", fields.apiKey ?? "");
  } else {
    return { ok: false, message: "Unknown integration." };
  }
  revalidatePath("/admin/settings/integrations");
  return { ok: true, message: `${service.charAt(0).toUpperCase() + service.slice(1)} connection saved.` };
}

/** Save which products affiliates see in the catalog, and in what order. */
export async function saveCatalogConfig(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({ order: z.array(z.string()), hidden: z.array(z.string()) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid catalog settings." };
  await writeSetting("catalog_config", JSON.stringify(parsed.data));
  revalidatePath("/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Catalog updated." };
}

/** Save which collections affiliates see, and in what order. */
export async function saveCollectionConfig(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z.object({ order: z.array(z.string()), hidden: z.array(z.string()) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid collection settings." };
  await writeSetting("collection_config", JSON.stringify(parsed.data));
  revalidatePath("/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Collections updated." };
}

/** Ping Shopify with the saved credentials so admins can verify the token works. */
export async function testShopifyConnection(): Promise<ActionResult> {
  await assertAdmin();
  if (!(await shopifyReady())) return { ok: false, message: "Enter a store domain and access token first." };
  try {
    const json = await shopifyGraphQL<any>(`{ shop { name myshopifyDomain } }`);
    if (json.errors?.length) return { ok: false, message: json.errors.map((e: any) => e.message).join(", ") };
    const name = json.data?.shop?.name;
    return { ok: true, message: name ? `Connected to “${name}”.` : "Connected to Shopify." };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Could not reach Shopify." };
  }
}

export async function disconnectIntegration(service: string): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const keys = INTEGRATION_KEYS[service];
  if (!keys) return { ok: false, message: "Unknown integration." };
  await db.delete(appSettings).where(inArray(appSettings.key, keys));
  revalidatePath("/admin/settings/integrations");
  return { ok: true, message: `${service.charAt(0).toUpperCase() + service.slice(1)} disconnected.` };
}

/** Update the signed-in admin's name / email. */
export async function updateAdminAccount(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return { ok: false, message: "Not signed in." };
  const parsed = z.object({ name: z.string().min(2), email: z.string().email() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const email = parsed.data.email.toLowerCase();
  const clash = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (clash && clash.id !== userId) return { ok: false, message: "That email is already in use." };
  await db.update(users).set({ name: parsed.data.name, email }).where(eq(users.id, userId));
  revalidatePath("/admin/settings/account");
  return { ok: true, message: "Account updated." };
}

/** Change the signed-in admin's password. */
export async function changeAdminPassword(input: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const userId = (session?.user as any)?.id;
  if (!userId) return { ok: false, message: "Not signed in." };
  const parsed = z
    .object({ current: z.string().min(1), next: z.string().min(6, "New password must be at least 6 characters") })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.passwordHash) return { ok: false, message: "No password on file." };
  const ok = await bcrypt.compare(parsed.data.current, user.passwordHash);
  if (!ok) return { ok: false, message: "Current password is incorrect." };
  await db.update(users).set({ passwordHash: await bcrypt.hash(parsed.data.next, 10) }).where(eq(users.id, userId));
  return { ok: true, message: "Password changed." };
}

/** Save brand/theme settings (stored as JSON under the "brand" key). */
export async function saveBrand(brand: unknown): Promise<ActionResult> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  const value = JSON.stringify(brand ?? {});
  await db
    .insert(appSettings)
    .values({ key: "brand", value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  revalidatePath("/admin/settings");
  revalidatePath("/login");
  return { ok: true, message: "Brand saved." };
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
