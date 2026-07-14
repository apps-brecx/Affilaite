"use server";

import { z } from "zod";
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
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { createDiscountForAffiliate } from "@/lib/discounts";
import { createPayoutBatch } from "@/lib/paypal";
import { sendBroadcast as sendEmails } from "@/lib/email";

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
