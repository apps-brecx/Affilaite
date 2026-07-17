// lib/attribution.ts — the core engine: coupon-first, link-second, last-click.
import { db } from "@/db";
import { orders, commissions, discountCodes, affiliates, programs, clicks, users } from "@/db/schema";
import { eq, inArray, gte, desc, and } from "drizzle-orm";
import { notify } from "./notifications";
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

  if (usedCodes.length) {
    const match = await db.query.discountCodes.findFirst({
      where: and(inArray(discountCodes.code, usedCodes), eq(discountCodes.active, true)),
    });
    if (match?.affiliateId) {
      affiliate = await db.query.affiliates.findFirst({ where: eq(affiliates.id, match.affiliateId) });
      attributedBy = "coupon";
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

  // 6. Calculate + record commission
  const program = affiliate.programId ? await getProgram(affiliate.programId) : await getDefaultProgram();
  if (!program) {
    await note("no commission program configured");
    return;
  }
  if (program.newCustomerOnly && !orderRow.isNewCustomer) {
    await note("skipped — returning customer (program is new-customers-only)");
    return;
  }

  const base = Number(order.subtotal_price); // commission on subtotal, not shipping/tax
  const amount =
    program.commissionType === "percent"
      ? (base * Number(program.commissionValue)) / 100
      : Number(program.commissionValue);

  // Idempotent: the partial unique index on commissions(order_id) WHERE
  // amount >= 0 means a second attribution of the same order is a no-op.
  const [created] = await db
    .insert(commissions)
    .values({
      orderId: orderRow.id,
      affiliateId: affiliate.id,
      programId: program.id,
      amount: amount.toFixed(2),
      currency: order.currency,
      attributedBy,
      status: "pending",
      approvableAt: new Date(Date.now() + program.holdDays * DAY),
    })
    .onConflictDoNothing()
    .returning({ id: commissions.id });

  if (!created) {
    await note(`attributed → ${affiliate.refCode} (${attributedBy})`);
    return; // already attributed — don't re-notify
  }

  await note(`attributed → ${affiliate.refCode} · ${order.currency} ${amount.toFixed(2)} (${attributedBy})`);

  // Track the affiliate sale back in Shopify so it's visible/filterable there.
  await tagOrderInShopify(order, affiliate.refCode);

  await notify(
    affiliate.id,
    "dashboard",
    "New sale attributed 🎉",
    `You earned ${order.currency} ${amount.toFixed(2)} on a new order.`,
    "/dashboard",
  );
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
