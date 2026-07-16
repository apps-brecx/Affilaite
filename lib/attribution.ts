// lib/attribution.ts — the core engine: coupon-first, link-second, last-click.
import { db } from "@/db";
import { orders, commissions, discountCodes, affiliates, programs, clicks, users, campaigns, affiliateCampaigns } from "@/db/schema";
import { eq, inArray, gte, desc, and, sql } from "drizzle-orm";
import { notify } from "./notifications";
import { sendEmailSafe } from "./email";
import { mergeConfig } from "./campaign-config";

const DAY = 864e5;
const round2 = (n: number) => Math.round(n * 100) / 100;

// Order sources we never pay commission on (POS / draft-order conversions).
const EXCLUDED_SOURCES = new Set(["pos", "shopify_draft_order"]);

async function getDefaultProgram() {
  return db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
}
async function getProgram(id: string) {
  return db.query.programs.findFirst({ where: eq(programs.id, id) });
}
async function getUserEmail(userId: string) {
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return u?.email ?? null;
}

/**
 * orders/create + orders/paid → attribute, calculate, and record a pending
 * commission. Safe to run more than once for the same order: the order mirror
 * and the commission insert are both idempotent, so a retry (or the paid event
 * following the create event) never double-books.
 */
export async function processOrderCreated(order: any) {
  if (!db) return;

  // 0. Never earn on test orders or POS / draft-order conversions.
  if (order.test === true) return;
  if (order.source_name && EXCLUDED_SOURCES.has(String(order.source_name))) return;

  // 1. Mirror the order (idempotent on shopifyOrderId). If it already exists
  //    (e.g. this is the orders/paid event after orders/create), reuse it.
  const [insertedOrder] = await db
    .insert(orders)
    .values({
      shopifyOrderId: String(order.id),
      orderNumber: order.name,
      customerEmail: order.email,
      subtotal: order.subtotal_price,
      total: order.total_price,
      currency: order.currency,
      discountCodesUsed: (order.discount_codes ?? []).map((d: any) => d.code?.toUpperCase()),
      financialStatus: order.financial_status,
      isNewCustomer: (order.customer?.orders_count ?? 1) <= 1,
    })
    .onConflictDoNothing({ target: orders.shopifyOrderId })
    .returning();

  const orderRow =
    insertedOrder ??
    (await db.query.orders.findFirst({ where: eq(orders.shopifyOrderId, String(order.id)) }));
  if (!orderRow) return;

  // Keep the mirrored financial status current as the order progresses.
  if (!insertedOrder && order.financial_status && order.financial_status !== orderRow.financialStatus) {
    await db.update(orders).set({ financialStatus: order.financial_status }).where(eq(orders.id, orderRow.id));
  }

  // 2. Only real money earns commission — the order must actually be paid.
  //    Unpaid orders are mirrored above but wait for the orders/paid webhook.
  if (order.financial_status !== "paid") return;

  // 3. PRIMARY: coupon match (source of truth)
  const usedCodes: string[] = (order.discount_codes ?? []).map((d: any) => d.code?.toUpperCase()).filter(Boolean);
  let affiliate: typeof affiliates.$inferSelect | undefined;
  let attributedBy: "coupon" | "link" | null = null;

  if (usedCodes.length) {
    const match = await db.query.discountCodes.findFirst({
      where: and(inArray(discountCodes.code, usedCodes), eq(discountCodes.active, true)),
    });
    if (match?.affiliateId) {
      affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, match.affiliateId) });
      attributedBy = "coupon";
    }
  }

  // 4. BACKUP: link cookie → most recent click within window (last-click)
  if (!affiliate && Array.isArray(order.note_attributes)) {
    const visitorId = order.note_attributes.find((a: any) => a.name === "_aff_vid")?.value;
    if (visitorId) {
      const prog = await getDefaultProgram();
      const windowStart = new Date(Date.now() - (prog?.cookieWindowDays ?? 30) * DAY);
      const recentClick = await db.query.clicks.findFirst({
        where: and(eq(clicks.visitorId, visitorId), gte(clicks.createdAt, windowStart)),
        orderBy: [desc(clicks.createdAt)],
      });
      if (recentClick?.affiliateId) {
        affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, recentClick.affiliateId) });
        attributedBy = "link";
      }
    }
  }

  if (!affiliate || affiliate.status !== "approved") return; // no attribution

  // 5. Fraud: block self-referral (buyer email == affiliate email)
  if (order.email && affiliate.userId) {
    const affEmail = await getUserEmail(affiliate.userId);
    if (affEmail && affEmail.toLowerCase() === String(order.email).toLowerCase()) return;
  }

  // 6. Calculate + record commission.
  // Base is the order subtotal (never shipping/tax). The program supplies the
  // hold window + the fallback rate; if the affiliate is in an active campaign,
  // that campaign's reward rules (rate, bonus, min-order, first-purchase, and
  // per-affiliate cap) take over so configured rewards actually pay.
  const program = affiliate.programId ? await getProgram(affiliate.programId) : await getDefaultProgram();
  const holdDays = program?.holdDays ?? 30;
  const base = Number(order.subtotal_price);
  const rate = (valueType: string, value: number) => (valueType === "percent" ? (base * value) / 100 : value);

  const [campRow] = await db
    .select({ camp: campaigns })
    .from(affiliateCampaigns)
    .innerJoin(campaigns, eq(affiliateCampaigns.campaignId, campaigns.id))
    .where(and(eq(affiliateCampaigns.affiliateId, affiliate.id), eq(campaigns.status, "active")))
    .orderBy(desc(affiliateCampaigns.createdAt))
    .limit(1);
  const campaign = campRow?.camp;

  let amount: number;
  let campaignId: string | null = null;

  if (campaign) {
    const cfg = mergeConfig(campaign.config);
    const cond = cfg.conditions;
    // Minimum order — by subtotal amount or by the customer's lifetime order count.
    if (cond.minOrderType === "amount" && base < Number(cond.minOrderValue || 0)) return;
    if (cond.minOrderType === "orders" && (order.customer?.orders_count ?? 1) < Number(cond.minOrderValue || 0)) return;
    // First-purchase-only trigger.
    if (cond.trigger === "first" && !orderRow.isNewCustomer) return;
    // Per-advocate cap: how many rewards this affiliate has already earned in this campaign.
    if (cond.maxPerAdvocateEnabled && Number(cond.maxPerAdvocate) > 0) {
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(commissions)
        .where(and(eq(commissions.affiliateId, affiliate.id), eq(commissions.campaignId, campaign.id), sql`${commissions.amount} >= 0`));
      if (Number(c) >= Number(cond.maxPerAdvocate)) return;
    }
    amount = rate(cfg.reward.valueType, Number(cfg.reward.value));
    if (cfg.reward.bonusEnabled && Number(cfg.reward.bonusValue) > 0) {
      amount += rate(cfg.reward.bonusType, Number(cfg.reward.bonusValue));
    }
    campaignId = campaign.id;
  } else {
    if (!program) return;
    if (program.newCustomerOnly && !orderRow.isNewCustomer) return;
    amount = rate(program.commissionType, Number(program.commissionValue));
  }

  amount = Math.round(amount * 100) / 100;
  if (!(amount > 0)) return; // nothing to pay (e.g. non-monetary custom reward)

  // Idempotent: the partial unique index on commissions(order_id) WHERE
  // amount >= 0 means a second attribution of the same order is a no-op.
  const [created] = await db
    .insert(commissions)
    .values({
      orderId: orderRow.id,
      affiliateId: affiliate.id,
      programId: program?.id ?? null,
      campaignId,
      amount: amount.toFixed(2),
      currency: order.currency,
      attributedBy,
      status: "pending",
      approvableAt: new Date(Date.now() + holdDays * DAY),
    })
    .onConflictDoNothing()
    .returning({ id: commissions.id });

  if (!created) return; // already attributed — don't re-notify

  await notify(
    affiliate.id,
    "dashboard",
    "New sale attributed 🎉",
    `You earned ${order.currency} ${amount.toFixed(2)} on a new order.`,
    "/dashboard",
  );

  // Email on the affiliate's FIRST sale — a real milestone worth celebrating.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(commissions)
    .where(and(eq(commissions.affiliateId, affiliate.id), sql`${commissions.amount} >= 0`));
  if (Number(count) === 1 && affiliate.userId) {
    const email = await getUserEmail(affiliate.userId);
    if (email) {
      await sendEmailSafe(
        email,
        "You made your first sale 🎉",
        `Congrats — you just earned your first commission of ${order.currency} ${amount.toFixed(2)}! Keep sharing your link and code to keep them coming.`,
      );
    }
  }
}

/**
 * Reduce the commission(s) on an order by a refunded fraction (0–1).
 * Unpaid commissions are reduced in place (fully refunded → reversed); already
 * paid commissions get a negative adjustment row that nets against the next
 * payout batch, since the money is already out the door.
 */
async function applyClawback(orderId: string, fraction: number) {
  const f = Math.max(0, Math.min(1, fraction));
  if (f <= 0) return;

  const comms = await db.query.commissions.findMany({ where: eq(commissions.orderId, orderId) });
  for (const c of comms) {
    const amt = Number(c.amount);
    if (amt < 0) continue; // skip existing adjustment rows

    if (c.status === "pending" || c.status === "approved") {
      const next = round2(amt * (1 - f));
      if (next < 0.01) {
        await db.update(commissions).set({ status: "reversed" }).where(eq(commissions.id, c.id));
      } else {
        await db.update(commissions).set({ amount: next.toFixed(2) }).where(eq(commissions.id, c.id));
      }
    } else if (c.status === "paid") {
      // Already paid — record a negative adjustment to settle next time.
      const delta = round2(amt * f);
      if (delta >= 0.01) {
        await db.insert(commissions).values({
          orderId: c.orderId,
          affiliateId: c.affiliateId,
          programId: c.programId,
          amount: (-delta).toFixed(2),
          currency: c.currency,
          attributedBy: "refund-adjustment",
          status: "approved",
          approvableAt: new Date(),
        });
      }
    }
  }
}

/** refunds/create → reverse the commission tied to this order, proportionally. */
export async function processRefund(refund: any) {
  if (!db) return;
  const orderRow = await db.query.orders.findFirst({
    where: eq(orders.shopifyOrderId, String(refund.order_id)),
  });
  if (!orderRow) return;

  // Commission is earned on subtotal, so clawback tracks refunded subtotal.
  const refundedSubtotal = (refund.refund_line_items ?? []).reduce((s: number, li: any) => {
    const v = li.subtotal_set?.shop_money?.amount ?? li.subtotal ?? 0;
    return s + Number(v || 0);
  }, 0);
  const orderSubtotal = Number(orderRow.subtotal ?? 0);
  const fraction = orderSubtotal > 0 ? refundedSubtotal / orderSubtotal : 0;

  // NOTE: fraction is measured against the original subtotal; across multiple
  // partial refunds this is exact for paid commissions and a close approximation
  // for still-unpaid ones.
  await applyClawback(orderRow.id, fraction);
}

/** orders/cancelled → treat as a full clawback (nothing was truly sold). */
export async function processCancelledOrder(order: any) {
  if (!db) return;
  const orderRow = await db.query.orders.findFirst({
    where: eq(orders.shopifyOrderId, String(order.id)),
  });
  if (!orderRow) return;
  await applyClawback(orderRow.id, 1);
}
