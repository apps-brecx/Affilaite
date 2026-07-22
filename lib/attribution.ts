// lib/attribution.ts — the core engine: coupon-first, link-second, last-click.
import { db } from "@/db";
import { orders, commissions, discountCodes, affiliates, programs, clicks, users, campaigns, affiliateCampaigns, promotions, groupMembers } from "@/db/schema";
import { eq, inArray, gte, lte, desc, and, sql } from "drizzle-orm";
import { notify } from "./notifications";
import { dispatchEmail } from "./email-center";
import { APP_URL } from "./links";
import { mergeConfig } from "./campaign-config";
import { shopifyGraphQL } from "./shopify";

/**
 * Best-effort: tag the order in Shopify so affiliate sales are trackable there.
 * Adds `affiliate:<CODE>` and `source:sipfluence` tags (searchable/filterable in
 * the Shopify admin). Needs the write_orders scope on the Admin API token; if it
 * isn't granted, this logs and moves on — it never fails attribution.
 */
async function tagOrderInShopify(order: any, refCode: string) {
  try {
    const id = order.admin_graphql_api_id ?? `gid://shopify/Order/${order.id}`;
    await shopifyGraphQL(
      `mutation affiliateTag($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) { userErrors { message } }
      }`,
      { id, tags: [`affiliate:${refCode}`, "source:sipfluence"] },
    );
  } catch (e) {
    console.error("[attribution] could not tag order in Shopify (needs write_orders scope?)", e);
  }
}

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
 * The best active-promotion bonus for this affiliate right now. A promotion
 * applies when the current time is within its window and it targets either
 * everyone (no group) or a group the affiliate belongs to. Returns the single
 * highest applicable bonus (bonuses don't stack, for predictable payouts).
 */
async function promotionBonus(affiliateId: string, base: number): Promise<{ bonus: number; name: string } | null> {
  if (!db) return null;
  const now = new Date();
  const promos = await db.query.promotions.findMany({
    where: and(lte(promotions.startsAt, now), gte(promotions.endsAt, now)),
  });
  if (!promos.length) return null;
  const mems = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.affiliateId, affiliateId));
  const myGroups = new Set(mems.map((m) => m.groupId));
  let best = 0;
  let name = "";
  for (const p of promos) {
    if (p.groupId && !myGroups.has(p.groupId)) continue; // targeted at a group they're not in
    const b = p.bonusType === "percent" ? (base * Number(p.bonusValue ?? 0)) / 100 : Number(p.bonusValue ?? 0);
    if (b > best) {
      best = b;
      name = p.name;
    }
  }
  return best > 0 ? { bonus: Math.round(best * 100) / 100, name } : null;
}

// Configurable thresholds (admin-tunable later via settings).
const FRAUD_HIGH_AMOUNT = 500; // a single commission above this looks unusual
const FRAUD_VELOCITY_WINDOW = 24 * 60 * 60 * 1000; // 24h
const FRAUD_VELOCITY_COUNT = 5; // this many commissions in the window is suspicious

/**
 * Lightweight fraud heuristics. Returns a human-readable reason string to flag
 * the commission for review, or null if it looks clean. Deliberately
 * conservative: flags for a human to check, never auto-rejects.
 */
async function screenForFraud(input: {
  affiliateId: string;
  orderEmail?: string | null;
  amount: number;
  base: number;
  isNewCustomer: boolean;
}): Promise<string | null> {
  // Unusually large single commission.
  if (input.amount >= FRAUD_HIGH_AMOUNT) return `High commission amount ($${input.amount.toFixed(2)})`;

  // Velocity: many commissions from this affiliate in a short window.
  const since = new Date(Date.now() - FRAUD_VELOCITY_WINDOW);
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)` })
    .from(commissions)
    .where(and(eq(commissions.affiliateId, input.affiliateId), gte(commissions.createdAt, since), sql`${commissions.amount} >= 0`));
  if (Number(c) >= FRAUD_VELOCITY_COUNT) return `High velocity (${Number(c)} sales in 24h)`;

  // Repeat buyer: the same customer email keeps converting for this affiliate.
  if (input.orderEmail) {
    const [{ r }] = await db
      .select({ r: sql<number>`count(*)` })
      .from(commissions)
      .innerJoin(orders, eq(commissions.orderId, orders.id))
      .where(and(eq(commissions.affiliateId, input.affiliateId), eq(orders.customerEmail, String(input.orderEmail).toLowerCase()), sql`${commissions.amount} >= 0`));
    if (Number(r) >= 3) return `Repeat buyer (${Number(r)} prior orders from this customer)`;
  }
  return null;
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

  // Record why an order did or didn't earn a commission, so the admin sees the
  // outcome ("attributed → DAVID15" / "self-referral blocked") instead of a
  // silent blank. Never throws — attribution outcome must not fail the webhook.
  const note = (status: string) =>
    db!.update(orders).set({ attributionStatus: status }).where(eq(orders.id, orderRow.id)).catch(() => {});

  // 2. Only real money earns commission — the order must actually be paid.
  //    Unpaid orders are mirrored above but wait for the orders/paid webhook.
  if (order.financial_status !== "paid") {
    await note("waiting for payment");
    return;
  }

  // 3. PRIMARY: coupon match (source of truth)
  const usedCodes: string[] = (order.discount_codes ?? []).map((d: any) => d.code?.toUpperCase()).filter(Boolean);
  let affiliate: typeof affiliates.$inferSelect | undefined;
  let attributedBy: "coupon" | "link" | null = null;
  // The campaign the matched coupon belongs to — the authoritative signal for
  // which campaign's reward rules apply (a code is issued by exactly one).
  let couponCampaignId: string | null = null;

  if (usedCodes.length) {
    const match = await db.query.discountCodes.findFirst({
      where: and(inArray(discountCodes.code, usedCodes), eq(discountCodes.active, true)),
    });
    if (match?.affiliateId) {
      affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, match.affiliateId) });
      attributedBy = "coupon";
      couponCampaignId = match.campaignId ?? null;
    }
  }

  // 4. BACKUP: referral link carried into checkout as order note attributes by
  //    the storefront snippet. Coupon still wins when both are present, so a
  //    sale is only ever credited once.
  if (!affiliate) {
    const attrs: Array<{ name?: string; value?: string }> = Array.isArray(order.note_attributes)
      ? order.note_attributes
      : [];
    const refCode = attrs.find((a) => a.name === "_aff_ref")?.value?.toUpperCase();
    const visitorId = attrs.find((a) => a.name === "_aff_vid")?.value;

    // 4a. Direct ref code — works even when the click row was never logged.
    if (refCode) {
      affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.refCode, refCode) });
      if (affiliate) attributedBy = "link";
    }

    // 4b. Fall back to the visitor id → most recent click within the window.
    if (!affiliate && visitorId) {
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

  if (!affiliate) {
    await note(usedCodes.length ? "coupon not linked to an affiliate" : "no affiliate code or link");
    return;
  }
  if (affiliate.status !== "approved") {
    await note(`skipped — ${affiliate.refCode} is ${affiliate.status}, not approved`);
    return;
  }

  // 5. Fraud: block self-referral (buyer email == affiliate's own email).
  //    Set ALLOW_SELF_REFERRAL=true (env) to permit it while testing.
  if (process.env.ALLOW_SELF_REFERRAL !== "true" && order.email && affiliate.userId) {
    const affEmail = await getUserEmail(affiliate.userId);
    if (affEmail && affEmail.toLowerCase() === String(order.email).toLowerCase()) {
      await note(`self-referral blocked — buyer is ${affiliate.refCode}'s own email`);
      return;
    }
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

  // Prefer the campaign the USED COUPON belongs to (the sale explicitly came
  // through that code). Only when the code isn't campaign-scoped — a program /
  // imported code, or a link-attributed sale — fall back to the affiliate's
  // most-recently-joined active campaign.
  let campRow:
    | { camp: typeof campaigns.$inferSelect }
    | undefined;
  if (couponCampaignId) {
    [campRow] = await db
      .select({ camp: campaigns })
      .from(affiliateCampaigns)
      .innerJoin(campaigns, eq(affiliateCampaigns.campaignId, campaigns.id))
      .where(and(
        eq(affiliateCampaigns.affiliateId, affiliate.id),
        eq(campaigns.id, couponCampaignId),
        eq(campaigns.status, "active"),
      ))
      .limit(1);
  }
  if (!campRow) {
    [campRow] = await db
      .select({ camp: campaigns })
      .from(affiliateCampaigns)
      .innerJoin(campaigns, eq(affiliateCampaigns.campaignId, campaigns.id))
      .where(and(eq(affiliateCampaigns.affiliateId, affiliate.id), eq(campaigns.status, "active")))
      .orderBy(desc(affiliateCampaigns.createdAt))
      .limit(1);
  }
  const campaign = campRow?.camp;

  let amount: number;
  let campaignId: string | null = null;

  if (campaign) {
    const cfg = mergeConfig(campaign.config);
    const cond = cfg.conditions;
    // Minimum order — by subtotal amount or by the customer's lifetime order count.
    if (cond.minOrderType === "amount" && base < Number(cond.minOrderValue || 0)) {
      await note(`skipped — order below campaign minimum ($${cond.minOrderValue})`);
      return;
    }
    if (cond.minOrderType === "orders" && (order.customer?.orders_count ?? 1) < Number(cond.minOrderValue || 0)) {
      await note("skipped — customer below campaign minimum order count");
      return;
    }
    // First-purchase-only trigger.
    if (cond.trigger === "first" && !orderRow.isNewCustomer) {
      await note("skipped — not a first purchase (campaign rule)");
      return;
    }
    // Per-advocate cap: how many rewards this affiliate has already earned in this campaign.
    if (cond.maxPerAdvocateEnabled && Number(cond.maxPerAdvocate) > 0) {
      const [{ c }] = await db
        .select({ c: sql<number>`count(*)` })
        .from(commissions)
        .where(and(eq(commissions.affiliateId, affiliate.id), eq(commissions.campaignId, campaign.id), sql`${commissions.amount} >= 0`));
      if (Number(c) >= Number(cond.maxPerAdvocate)) {
        await note("skipped — campaign per-affiliate reward cap reached");
        return;
      }
    }
    // A "custom" reward (e.g. a free product, a gift) is fulfilled by hand — it
    // must NOT book a cash commission off the leftover value field. cash / credit
    // / coupon all settle as a cash payout on our single payout rail.
    if (cfg.reward.kind === "custom") {
      await note(`attributed → ${affiliate.refCode} · custom reward (${cfg.reward.custom || "manual"}) — no cash commission`);
      return;
    }
    amount = rate(cfg.reward.valueType, Number(cfg.reward.value));
    if (cfg.reward.bonusEnabled && Number(cfg.reward.bonusValue) > 0) {
      amount += rate(cfg.reward.bonusType, Number(cfg.reward.bonusValue));
    }
    campaignId = campaign.id;
  } else {
    if (!program) {
      await note("no commission program configured");
      return;
    }
    if (program.newCustomerOnly && !orderRow.isNewCustomer) {
      await note("skipped — returning customer (program is new-customers-only)");
      return;
    }
    amount = rate(program.commissionType, Number(program.commissionValue));
  }

  amount = Math.round(amount * 100) / 100;

  // Live promotion bonus: if an active promotion targets this affiliate (their
  // group, or everyone), add its bonus on top so a launched "+X% bonus" is real.
  const promo = await promotionBonus(affiliate.id, base);
  if (promo) amount = Math.round((amount + promo.bonus) * 100) / 100;

  if (!(amount > 0)) {
    await note("skipped — no monetary reward");
    return; // nothing to pay (e.g. non-monetary custom reward)
  }

  // Fraud screening — flagged commissions are held for manual review and never
  // auto-approve. Heuristics run on the buyer + this affiliate's recent history.
  const flag = await screenForFraud({ affiliateId: affiliate.id, orderEmail: order.email, amount, base, isNewCustomer: !!orderRow.isNewCustomer });

  // Approval mode: campaign config wins; else auto (mature after hold window).
  const approvalMode = campaign ? mergeConfig(campaign.config).approval.mode : "auto";
  // Manual mode or a fraud flag => hold indefinitely (approvableAt = null) so the
  // maturation cron never clears it; an admin decides.
  const approvableAt = flag || approvalMode === "manual" ? null : new Date(Date.now() + holdDays * DAY);

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
      approvableAt,
      flagged: !!flag,
      flagReason: flag,
    })
    .onConflictDoNothing()
    .returning({ id: commissions.id });

  if (!created) {
    await note(`attributed → ${affiliate.refCode} (${attributedBy})`);
    return; // already attributed — don't re-notify
  }

  await note(
    `attributed → ${affiliate.refCode} · ${order.currency} ${amount.toFixed(2)} (${attributedBy})${flag ? " · flagged for review" : ""}`,
  );

  // Track the affiliate sale back in Shopify so it's visible/filterable there.
  await tagOrderInShopify(order, affiliate.refCode);

  await notify(
    affiliate.id,
    "dashboard",
    "New sale attributed 🎉",
    `You earned ${order.currency} ${amount.toFixed(2)} on a new order.`,
    "/dashboard",
  );

  // Real-time sale alert by email — every sale, not just the first. The first
  // sale gets a celebratory milestone message; later ones a "cha-ching" nudge.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(commissions)
    .where(and(eq(commissions.affiliateId, affiliate.id), sql`${commissions.amount} >= 0`));
  const prefs = (affiliate.notificationPrefs as Record<string, boolean>) ?? {};
  if (affiliate.userId && prefs.newCommission !== false) {
    const user = await db.query.users.findFirst({ where: eq(users.id, affiliate.userId) });
    if (user?.email) {
      const first = Number(count) === 1;
      // Routed through the Notification Center so admins can edit/disable it.
      await dispatchEmail(first ? "first_sale" : "repeat_sale", user.email, {
        name: user.name ?? "there",
        amount: amount.toFixed(2),
        currency: order.currency,
        dashboardUrl: `${APP_URL}/dashboard`,
      });
    }
  }
}

/**
 * Reduce the commission(s) on an order by a refunded fraction (0–1).
 * Unpaid commissions are reduced in place (fully refunded → reversed); already
 * paid commissions get a negative adjustment row that nets against the next
 * payout batch, since the money is already out the door.
 */
/**
 * Claw back the CHANGE in refunded fraction (prevF → newF) — always measured
 * against the original commission, so multiple partial refunds sum to the right
 * total instead of compounding as (1-f)^N.
 *
 * Policy: we never rob an affiliate of money already sent to them. Unpaid
 * commissions (pending/approved) shrink with the refund and, once fully
 * refunded, become "cancelled". Already-paid commissions are only touched on a
 * FULL cancellation, where they're marked "cancelled" so they drop out of "paid
 * lifetime" — but no negative balance is created and nothing is deducted from
 * future payouts. The platform absorbs the cost.
 *
 * Returns the affiliate ids whose commission was fully cancelled, so the caller
 * can notify them.
 */
async function applyClawback(orderId: string, prevF: number, newF: number): Promise<string[]> {
  const p = Math.max(0, Math.min(1, prevF));
  const n = Math.max(0, Math.min(1, newF));
  const deltaF = n - p;
  if (deltaF <= 0) return [];
  const fullyCancelled = n >= 0.999;
  const cancelledAffiliates = new Set<string>();

  const comms = await db.query.commissions.findMany({ where: eq(commissions.orderId, orderId) });
  for (const c of comms) {
    const amt = Number(c.amount);
    if (amt < 0) continue; // skip any legacy negative adjustment rows
    if (c.status === "reversed" || c.status === "rejected" || c.status === "cancelled") continue;
    // Recover the original commission from the amount still on the row (which may
    // already reflect earlier partial refunds) using the previous cumulative F.
    const original = p < 1 ? amt / (1 - p) : amt;

    if (c.status === "pending" || c.status === "approved") {
      const next = round2(amt - original * deltaF);
      if (next < 0.01 || fullyCancelled) {
        await db.update(commissions).set({ status: "cancelled" }).where(eq(commissions.id, c.id));
        if (c.affiliateId) cancelledAffiliates.add(c.affiliateId);
      } else {
        await db.update(commissions).set({ amount: next.toFixed(2) }).where(eq(commissions.id, c.id));
      }
    } else if (c.status === "paid" && fullyCancelled) {
      // Already paid out — we don't claw the money back. On a full cancellation
      // mark it cancelled so it stops counting as "paid lifetime", but create no
      // negative balance.
      await db.update(commissions).set({ status: "cancelled" }).where(eq(commissions.id, c.id));
      if (c.affiliateId) cancelledAffiliates.add(c.affiliateId);
    }
  }
  return [...cancelledAffiliates];
}

/** Notify affiliates that an order they earned on was cancelled. */
async function notifyCancelled(affiliateIds: string[], orderRow: any) {
  if (!affiliateIds.length) return;
  const label = orderRow?.orderNumber ? `#${orderRow.orderNumber}` : "your referred order";
  await notify(
    affiliateIds,
    "performance",
    `Order ${label} was cancelled`,
    "This order was cancelled, so its commission has been removed. Any commission already paid to you is yours to keep.",
    "/performance",
  );
}

/** refunds/create → reverse the commission tied to this order, proportionally. */
export async function processRefund(refund: any) {
  if (!db) return;
  const orderRow = await db.query.orders.findFirst({
    where: eq(orders.shopifyOrderId, String(refund.order_id)),
  });
  if (!orderRow) return;

  // Idempotency: never apply the same refund twice (webhook retries).
  const rid = refund.id != null ? String(refund.id) : null;
  const seen: string[] = Array.isArray(orderRow.refundIds) ? orderRow.refundIds : [];
  if (rid && seen.includes(rid)) return;

  // Commission is earned on subtotal, so clawback tracks refunded subtotal.
  const thisRefundSubtotal = (refund.refund_line_items ?? []).reduce((s: number, li: any) => {
    const v = li.subtotal_set?.shop_money?.amount ?? li.subtotal ?? 0;
    return s + Number(v || 0);
  }, 0);
  const orderSubtotal = Number(orderRow.subtotal ?? 0);
  const prevRefunded = Number(orderRow.refundedSubtotal ?? 0);
  const newRefunded = prevRefunded + thisRefundSubtotal;

  // Record the refund + new cumulative total FIRST, so a retry short-circuits
  // above and can never double-book the clawback.
  await db
    .update(orders)
    .set({ refundedSubtotal: newRefunded.toFixed(2), refundIds: rid ? [...seen, rid] : seen })
    .where(eq(orders.id, orderRow.id));

  if (thisRefundSubtotal <= 0 || orderSubtotal <= 0) return;
  const prevF = prevRefunded / orderSubtotal;
  const newF = newRefunded / orderSubtotal;
  const cancelled = await applyClawback(orderRow.id, prevF, newF);
  await notifyCancelled(cancelled, orderRow);
}

/** orders/cancelled → treat as a full clawback (nothing was truly sold) and mark
 *  the order cancelled so it's visible as such in the admin. */
export async function processCancelledOrder(order: any) {
  if (!db) return;
  const orderRow = await db.query.orders.findFirst({
    where: eq(orders.shopifyOrderId, String(order.id)),
  });
  if (!orderRow) return;
  const had = await db.query.commissions.findFirst({ where: eq(commissions.orderId, orderRow.id) });
  // Full clawback: from whatever's already been refunded up to 100%.
  const orderSubtotal = Number(orderRow.subtotal ?? 0);
  const prevF = orderSubtotal > 0 ? Number(orderRow.refundedSubtotal ?? 0) / orderSubtotal : 0;
  const cancelled = await applyClawback(orderRow.id, prevF, 1);
  await db
    .update(orders)
    .set({
      financialStatus: "cancelled",
      refundedSubtotal: orderSubtotal > 0 ? orderSubtotal.toFixed(2) : orderRow.refundedSubtotal,
      attributionStatus: had ? "cancelled — commission reversed" : "cancelled — no commission",
    })
    .where(eq(orders.id, orderRow.id));
  await notifyCancelled(cancelled, orderRow);
}
