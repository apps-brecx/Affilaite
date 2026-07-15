// lib/attribution.ts — the core engine: coupon-first, link-second, last-click.
import { db } from "@/db";
import { orders, commissions, discountCodes, affiliates, programs, clicks, users } from "@/db/schema";
import { eq, inArray, gte, desc, and } from "drizzle-orm";
import { notify } from "./notifications";

const DAY = 864e5;

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

/** orders/create → attribute, calculate, and record a pending commission. */
export async function processOrderCreated(order: any) {
  if (!db) return;

  // 1. Mirror the order (idempotent on shopifyOrderId)
  const [orderRow] = await db
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

  if (!orderRow) return; // duplicate webhook

  // 2. PRIMARY: coupon match (source of truth)
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

  // 3. BACKUP: link cookie → most recent click within window (last-click)
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

  // 4. Fraud: block self-referral (buyer email == affiliate email)
  if (order.email && affiliate.userId) {
    const affEmail = await getUserEmail(affiliate.userId);
    if (affEmail && affEmail.toLowerCase() === String(order.email).toLowerCase()) return;
  }

  // 5. Calculate + record commission
  const program = affiliate.programId ? await getProgram(affiliate.programId) : await getDefaultProgram();
  if (!program) return;
  if (program.newCustomerOnly && !orderRow.isNewCustomer) return;

  const base = Number(order.subtotal_price); // commission on subtotal, not shipping/tax
  const amount =
    program.commissionType === "percent"
      ? (base * Number(program.commissionValue)) / 100
      : Number(program.commissionValue);

  await db.insert(commissions).values({
    orderId: orderRow.id,
    affiliateId: affiliate.id,
    programId: program.id,
    amount: amount.toFixed(2),
    currency: order.currency,
    attributedBy,
    status: "pending",
    approvableAt: new Date(Date.now() + program.holdDays * DAY),
  });

  await notify(
    affiliate.id,
    "dashboard",
    "New sale attributed 🎉",
    `You earned ${order.currency} ${amount.toFixed(2)} on a new order.`,
    "/dashboard",
  );
}

/** refunds/create → reverse the commission tied to this order. */
export async function processRefund(refund: any) {
  if (!db) return;
  const orderRow = await db.query.orders.findFirst({
    where: eq(orders.shopifyOrderId, String(refund.order_id)),
  });
  if (!orderRow) return;
  await db
    .update(commissions)
    .set({ status: "reversed" })
    .where(
      and(eq(commissions.orderId, orderRow.id), inArray(commissions.status, ["pending", "approved"])),
    );
  // For partial refunds: compute refunded fraction and reduce `amount` proportionally instead.
}
