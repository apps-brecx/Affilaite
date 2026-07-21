// lib/payouts.ts — the payout engine.
//
// This is a PLAIN server module (not "use server"), so none of these functions
// are exposed as callable POST endpoints. They move real money, so they must
// only be reachable from code that has already authorized the caller:
//   - admin UI  → thin `assertAdmin("payouts")` wrappers in app/actions/admin.ts
//   - cron      → app/api/cron/route.ts, gated by CRON_SECRET
//   - payouts page (server component, admin-gated by the layout)

import crypto from "crypto";
import { and, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { affiliates, programs, commissions, payouts, payoutItems, users, campaigns, affiliateCampaigns, appSettings } from "@/db/schema";
import { getSetting } from "@/lib/queries";
import { paypalReady } from "@/lib/integrations";
import { createPayoutBatch, getPayoutBatch, parsePayoutBatch, rollupBatchStatus } from "@/lib/paypal";
import { notify } from "@/lib/notifications";
import { dispatchEmail } from "@/lib/email-center";
import { mergeConfig } from "@/lib/campaign-config";

type ActionResult = { ok: boolean; message: string };

// PayPal transaction_status values that mean the money did NOT reach the
// affiliate and won't on its own — the commission must go back to unpaid.
const TERMINAL_FAILED = new Set(["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED"]);

async function setSetting(key: string, value: string) {
  if (!db) return;
  await db
    .insert(appSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
}

/**
 * Create the batch, retrying ONCE on failure with the same senderBatchId. Because
 * createPayoutBatch sends `PayPal-Request-Id: senderBatchId`, PayPal dedupes the
 * retry: if the first attempt actually succeeded but its response was lost, the
 * retry returns the SAME batch (no second payout); if the batch genuinely failed
 * (insufficient funds, etc.), the retry fails too and we roll back. This closes
 * the double-pay window where a lost response used to release the claim and let
 * the next run pay again under a brand-new id.
 */
async function createPayoutBatchIdempotent(senderBatchId: string, recipients: Parameters<typeof createPayoutBatch>[1]) {
  try {
    return await createPayoutBatch(senderBatchId, recipients);
  } catch (first) {
    console.warn("[payouts] first attempt failed, retrying idempotently:", (first as any)?.message);
    return await createPayoutBatch(senderBatchId, recipients); // same id → PayPal won't double-pay
  }
}

/**
 * Poll PayPal for a batch's real state and update our item + batch statuses.
 * Flips a batch from "processing" to "success"/"failed" once PayPal finishes.
 * When an item lands in a terminal-failed state, its commissions are returned to
 * `approved` (payoutId cleared) so they re-enter the next batch — the affiliate
 * is never left marked-paid for money that never arrived.
 */
export async function reconcilePayout(payoutId: string): Promise<{ ok: boolean; status?: string; message?: string }> {
  if (!db) return { ok: false, message: "Database not configured." };
  const batch = await db.query.payouts.findFirst({ where: eq(payouts.id, payoutId) });
  if (!batch) return { ok: false, message: "Batch not found." };
  if (!batch.paypalBatchId || batch.status === "success" || batch.status === "failed") {
    return { ok: true, status: batch.status };
  }
  try {
    const parsed = parsePayoutBatch(await getPayoutBatch(batch.paypalBatchId));
    // Update each local item from PayPal (matched by our id == sender_item_id).
    for (const pi of parsed.items) {
      if (!pi.senderItemId) continue;
      await db
        .update(payoutItems)
        .set({ transactionStatus: pi.transactionStatus, ...(pi.payoutItemId ? { paypalItemId: pi.payoutItemId } : {}) })
        .where(eq(payoutItems.id, pi.senderItemId));
    }

    // Re-read our items (now with fresh statuses) and revert commissions for any
    // that terminally failed, so the money becomes payable again.
    const localItems = await db.select().from(payoutItems).where(eq(payoutItems.payoutId, payoutId));
    for (const item of localItems) {
      if (!item.transactionStatus || !TERMINAL_FAILED.has(item.transactionStatus)) continue;
      if (!item.affiliateId) continue;
      await db
        .update(commissions)
        .set({ status: "approved", payoutId: null })
        .where(
          and(
            eq(commissions.payoutId, payoutId),
            eq(commissions.affiliateId, item.affiliateId),
            eq(commissions.currency, item.currency ?? "USD"),
            eq(commissions.status, "paid"),
          ),
        );
    }

    const statuses = localItems.map((i) => i.transactionStatus ?? "PENDING");
    const rolled = rollupBatchStatus(statuses);
    if (rolled !== batch.status) {
      await db.update(payouts).set({ status: rolled }).where(eq(payouts.id, payoutId));
    }
    return { ok: true, status: rolled };
  } catch (e: any) {
    console.error("[reconcilePayout]", e);
    return { ok: false, message: e?.message ?? "Couldn't refresh from PayPal." };
  }
}

/** Reconcile every batch still marked "processing" (page load / cron). */
export async function reconcileProcessingPayouts(): Promise<void> {
  if (!db) return;
  const pending = await db
    .select({ id: payouts.id })
    .from(payouts)
    .where(and(eq(payouts.status, "processing"), isNotNull(payouts.paypalBatchId)));
  for (const p of pending) await reconcilePayout(p.id);
}

const SCHEDULE_DAYS: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 };

/**
 * Cron: run a payout batch on the configured schedule (weekly/monthly/…). Pays
 * every affiliate who clears their minimum — the schedule never overrides it.
 */
export async function runScheduledPayout(): Promise<string> {
  if (!db) return "";
  const schedule = await getSetting("payout_schedule", "manual");
  const intervalDays = SCHEDULE_DAYS[schedule];
  if (!intervalDays) return "";
  if (!(await paypalReady())) return "";

  const last = await getSetting("payout_last_run", "");
  const due = !last || Date.now() - new Date(last).getTime() >= intervalDays * 86_400_000;
  if (!due) return "";

  try {
    const res = await executePayout();
    await setSetting("payout_last_run", new Date().toISOString());
    return res.ok ? "Scheduled payout run." : "";
  } catch (e) {
    console.error("[runScheduledPayout]", e);
    return "";
  }
}

/** Effective payout mode for an affiliate: active campaign wins, else global. */
async function effectivePayoutMode(affiliateId: string, globalDefault: string): Promise<string> {
  if (!db) return globalDefault;
  const [row] = await db
    .select({ config: campaigns.config })
    .from(affiliateCampaigns)
    .innerJoin(campaigns, eq(affiliateCampaigns.campaignId, campaigns.id))
    .where(and(eq(affiliateCampaigns.affiliateId, affiliateId), eq(campaigns.status, "active")))
    .orderBy(desc(affiliateCampaigns.createdAt))
    .limit(1);
  if (row) return mergeConfig(row.config).payout.mode === "automatic" ? "automatic" : "manual";
  return globalDefault;
}

/** Pay newly-approved commissions for affiliates whose effective mode is automatic. */
export async function maybeAutoPayout(affiliateIds?: string[]): Promise<string> {
  if (!db) return "";
  if (!(await paypalReady())) return "";
  const globalDefault = (await getSetting("default_payout_mode", "manual")) === "automatic" ? "automatic" : "manual";

  let candidates = affiliateIds;
  if (!candidates) {
    const rows = await db
      .selectDistinct({ id: commissions.affiliateId })
      .from(commissions)
      .where(and(eq(commissions.status, "approved"), isNull(commissions.payoutId)));
    candidates = rows.map((r) => r.id).filter(Boolean) as string[];
  }
  if (!candidates.length) return "";

  const autoIds: string[] = [];
  for (const id of candidates) {
    if ((await effectivePayoutMode(id, globalDefault)) === "automatic") autoIds.push(id);
  }
  if (!autoIds.length) return "";

  try {
    const res = await executePayout(autoIds);
    return res.ok ? "Auto-payout sent." : "";
  } catch (e) {
    console.error("[maybeAutoPayout]", e);
    return "";
  }
}

/**
 * The payout engine. Claims approved commissions, submits a PayPal batch, and
 * only marks them paid once the batch is accepted. Never fakes a payout and
 * never double-pays. NOT exported as an action — reachable only via the gated
 * wrappers / cron.
 */
export async function executePayout(scopeAffiliateIds?: string[], opts?: { ignoreMinimum?: boolean }): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  if (!(await paypalReady())) return { ok: false, message: "Connect PayPal first (Settings → Integrations)." };
  if (scopeAffiliateIds && scopeAffiliateIds.length === 0) return { ok: false, message: "Nothing payable right now." };

  const rows = await db
    .select({
      affiliateId: affiliates.id,
      paypalEmail: affiliates.paypalEmail,
      phone: affiliates.phone,
      phoneVerifiedAt: affiliates.phoneVerifiedAt,
      method: affiliates.payoutMethod,
      minimum: programs.payoutMinimum,
      total: sql<string>`coalesce(sum(${commissions.amount}),0)`,
    })
    .from(commissions)
    .innerJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(programs, eq(affiliates.programId, programs.id))
    .where(and(
      eq(commissions.status, "approved"),
      isNull(commissions.payoutId),
      eq(affiliates.status, "approved"),
      ...(scopeAffiliateIds ? [inArray(affiliates.id, scopeAffiliateIds)] : []),
    ))
    .groupBy(affiliates.id, affiliates.paypalEmail, affiliates.phone, affiliates.phoneVerifiedAt, affiliates.payoutMethod, programs.payoutMinimum);

  // Venmo requires a VERIFIED phone — never send money to an unverified number.
  const receiverOf = (r: { method: "paypal" | "venmo"; phone: string | null; phoneVerifiedAt: Date | null; paypalEmail: string | null }) =>
    r.method === "venmo" ? (r.phoneVerifiedAt ? r.phone : null) : r.paypalEmail;
  const payable = rows.filter(
    (r) => receiverOf(r) && (opts?.ignoreMinimum || Number(r.total) >= Number(r.minimum ?? 0)) && Number(r.total) > 0,
  );
  if (payable.length === 0) {
    const heldByMin = rows.some((r) => receiverOf(r) && Number(r.total) > 0);
    return { ok: false, message: heldByMin ? "Everyone approved is under their payout minimum. Use “Pay now” to pay anyway, or lower the minimum." : "Nothing payable right now." };
  }

  const methodFor = new Map(
    payable.map((r) => [r.affiliateId, { method: r.method, receiver: receiverOf(r)! }] as const),
  );
  const payableIds = payable.map((r) => r.affiliateId);
  const batchId = crypto.randomUUID();
  const senderBatchId = `AFF-${batchId}`;

  type Recipient = { senderItemId: string; amount: string; receiver: string; method: "paypal" | "venmo"; currency: string; affiliateId: string };
  let recipients: Recipient[] = [];
  let claimedTotal = 0;
  try {
    recipients = await db.transaction(async (tx) => {
      await tx.insert(payouts).values({
        id: batchId,
        senderBatchId,
        status: "processing",
        totalAmount: "0",
        affiliateCount: payable.length,
      });

      const claimed = await tx
        .update(commissions)
        .set({ payoutId: batchId })
        .where(and(eq(commissions.status, "approved"), isNull(commissions.payoutId), inArray(commissions.affiliateId, payableIds)))
        .returning({ affiliateId: commissions.affiliateId, amount: commissions.amount, currency: commissions.currency });

      if (claimed.length === 0) throw new Error("NOTHING_CLAIMED");

      const groups = new Map<string, { affiliateId: string; currency: string; total: number }>();
      for (const c of claimed) {
        if (!c.affiliateId) continue;
        const currency = c.currency ?? "USD";
        const key = `${c.affiliateId}:${currency}`;
        const g = groups.get(key) ?? { affiliateId: c.affiliateId, currency, total: 0 };
        g.total += Number(c.amount);
        groups.set(key, g);
      }

      const recs: Recipient[] = [];
      let grand = 0;
      for (const g of groups.values()) {
        if (g.total <= 0) continue;
        const amount = g.total.toFixed(2);
        const [item] = await tx
          .insert(payoutItems)
          .values({ payoutId: batchId, affiliateId: g.affiliateId, amount, currency: g.currency, transactionStatus: "PENDING" })
          .returning({ id: payoutItems.id });
        const m = methodFor.get(g.affiliateId)!;
        recs.push({ senderItemId: item.id, amount, receiver: m.receiver, method: m.method, currency: g.currency, affiliateId: g.affiliateId });
        grand += g.total;
      }

      claimedTotal = grand;
      await tx.update(payouts).set({ totalAmount: grand.toFixed(2), affiliateCount: recs.length }).where(eq(payouts.id, batchId));
      return recs;
    });
  } catch (e: any) {
    if (e?.message === "NOTHING_CLAIMED") return { ok: false, message: "Nothing payable right now." };
    console.error("[executePayout] claim transaction failed:", e);
    return { ok: false, message: "Couldn't prepare the payout — see logs." };
  }

  if (recipients.length === 0) {
    // Everything netted to zero/negative — release the whole claim (nothing was
    // paid, so no clawback is lost).
    await db.update(commissions).set({ payoutId: null }).where(eq(commissions.payoutId, batchId));
    await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, batchId));
    return { ok: false, message: "Nothing payable right now." };
  }

  // Money leaves the account here. The idempotent retry means a lost response
  // never causes a second payout; a genuine failure throws and we roll back.
  try {
    const res = await createPayoutBatchIdempotent(senderBatchId, recipients);
    await db.update(payouts).set({ paypalBatchId: res.payoutBatchId }).where(eq(payouts.id, batchId));
  } catch (e) {
    console.error("[executePayout] PayPal error:", e);
    await db.update(commissions).set({ payoutId: null }).where(eq(commissions.payoutId, batchId));
    await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, batchId));
    return { ok: false, message: "PayPal batch failed — nothing was charged. See logs." };
  }

  // Success: only the claimed rows become paid. reconcile then reverts any
  // per-item terminal failures back to approved.
  await db.update(commissions).set({ status: "paid" }).where(eq(commissions.payoutId, batchId));
  await reconcilePayout(batchId).catch(() => {});

  const recAffIds = [...new Set(recipients.map((r) => r.affiliateId))];
  const recAffs = await db.query.affiliates.findMany({ where: inArray(affiliates.id, recAffIds) });
  const recUsers = recAffs.length ? await db.query.users.findMany({ where: inArray(users.id, recAffs.map((a) => a.userId)) }) : [];
  const emailByAff = new Map(recAffs.map((a) => [a.id, recUsers.find((u) => u.id === a.userId)?.email ?? null]));
  const nameByAff = new Map(recAffs.map((a) => [a.id, recUsers.find((u) => u.id === a.userId)?.name ?? "there"]));
  const prefsByAff = new Map(recAffs.map((a) => [a.id, (a.notificationPrefs as Record<string, boolean>) ?? {}]));
  for (const affiliateId of recAffIds) {
    await notify(affiliateId, "payouts", "Payout sent 💸", "Your commission is on its way to you.", "/payouts");
    // Report the amount in the currency it was actually paid in (usually one
    // currency per affiliate; if mixed, PayPal split it into per-currency items).
    const recs = recipients.filter((r) => r.affiliateId === affiliateId);
    const total = recs.reduce((s, r) => s + Number(r.amount), 0);
    const currency = recs[0]?.currency ?? "USD";
    const email = emailByAff.get(affiliateId);
    if (email && prefsByAff.get(affiliateId)?.payoutSent !== false) {
      await dispatchEmail("payout_sent", email, { name: nameByAff.get(affiliateId) ?? "there", amount: total.toFixed(2), currency });
    }
  }

  return { ok: true, message: `PayPal batch submitted for ${recipients.length} payout(s) — ${claimedTotal.toFixed(2)} total.` };
}
