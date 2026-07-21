"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { and, eq, inArray, isNull, isNotNull, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  affiliates,
  users,
  programs,
  groups,
  groupMembers,
  groupMessages,
  promotions,
  commissions,
  discountCodes,
  orders,
  payouts,
  payoutItems,
  messages,
  inviteTemplates,
  campaigns,
  affiliateCampaigns,
  appSettings,
  sampleRequests,
  discoveredPosts,
  directMessages,
  groupMessageReads,
  pollVotes,
  posts,
  clicks,
  notifications,
  passwordResetTokens,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  createDiscountForAffiliate,
  createDiscountWithUniqueCode,
  customerDiscountFromConfig,
  resolveCampaignDiscountOptions,
  updateDiscountInShopify,
  deleteDiscountInShopify,
  setDiscountActiveInShopify,
  makeDiscountCombinable,
  uniqueDiscountCode,
} from "@/lib/discounts";
import { upsertShopifyCustomer } from "@/lib/shopify-customers";
import { createPayoutBatch, getPayoutBatch, parsePayoutBatch, rollupBatchStatus } from "@/lib/paypal";
import { executePayout, maybeAutoPayout, reconcilePayout as reconcilePayoutCore } from "@/lib/payouts";
import { sendEmail } from "@/lib/email";
import { dispatchEmail, renderBrandedEmail, sendRichBroadcast } from "@/lib/email-center";
import { sendVerification } from "@/lib/sms";
import { normalizePhone } from "@/lib/phone";
import { normalizeAddress, composeAddress } from "@/lib/address";
import { defaultConfig, mergeConfig } from "@/lib/campaign-config";
import { shopifyReady, paypalReady, emailReady, encryptSecret } from "@/lib/integrations";
import { shopifyGraphQL } from "@/lib/shopify";
import { processOrderCreated, processCancelledOrder } from "@/lib/attribution";
import { createSampleDraftOrder } from "@/lib/samples";
import { getEarningsSeries, getSetting } from "@/lib/queries";
import { getCatalogItemIds } from "@/lib/products";
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

async function assertAdmin(area?: string) {
  const session = await auth();
  const u = session?.user as any;
  if (u?.role !== "admin") throw new Error("Unauthorized");
  // Owners bypass; team members need the specific area. `undefined` area means
  // "any admin" (self-service actions like managing your own account).
  if (area && !u.isOwner && !(Array.isArray(u.permissions) && u.permissions.includes(area))) {
    throw new Error("You don't have access to this area.");
  }
}

/**
 * Backfill: pull recent orders from Shopify and run any that used an affiliate
 * discount code through attribution. Idempotent (order mirror + commission are
 * both idempotent), so it's safe to run repeatedly. Use it to capture affiliate
 * sales that happened before the Shopify webhook was live.
 */
export async function importAffiliateOrders(): Promise<ActionResult> {
  await assertAdmin("orders");
  if (!(await shopifyReady())) return { ok: false, message: "Connect Shopify first (Settings → Integrations)." };

  const codeRows = await db
    .select({ code: discountCodes.code })
    .from(discountCodes)
    .where(isNotNull(discountCodes.affiliateId));
  const affiliateCodes = new Set(codeRows.map((c) => c.code.toUpperCase()));
  if (affiliateCodes.size === 0) return { ok: false, message: "No affiliate discount codes exist yet." };

  const query = `
    query($cursor: String) {
      orders(first: 100, after: $cursor, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges { node {
          id name email test sourceName displayFinancialStatus currencyCode cancelledAt
          subtotalPriceSet { shopMoney { amount } }
          totalPriceSet { shopMoney { amount } }
          discountCodes
          customer { numberOfOrders }
          customAttributes { key value }
        } }
      }
    }`;

  let cursor: string | null = null;
  let scanned = 0;
  const processedIds: string[] = [];
  // Cap the scan (most recent ~500 orders) so a large store can't run forever.
  for (let page = 0; page < 5; page++) {
    const json: any = await shopifyGraphQL<any>(query, { cursor });
    const conn: any = json?.data?.orders;
    if (!conn) break;
    for (const edge of conn.edges ?? []) {
      const o = edge.node;
      scanned++;
      const codes: string[] = (o.discountCodes ?? []).map((c: string) => String(c).toUpperCase());
      if (!codes.some((c) => affiliateCodes.has(c))) continue;
      const numericId = String(o.id).split("/").pop()!;
      const payload = {
        id: numericId,
        admin_graphql_api_id: o.id,
        name: o.name,
        email: o.email,
        test: o.test,
        source_name: o.sourceName,
        financial_status: String(o.displayFinancialStatus ?? "").toLowerCase(),
        currency: o.currencyCode,
        subtotal_price: o.subtotalPriceSet?.shopMoney?.amount,
        total_price: o.totalPriceSet?.shopMoney?.amount,
        discount_codes: codes.map((code) => ({ code })),
        customer: o.customer ? { orders_count: Number(o.customer.numberOfOrders) } : undefined,
        note_attributes: (o.customAttributes ?? []).map((a: any) => ({ name: a.key, value: a.value })),
      };
      await processOrderCreated(payload);
      // Cancelled in Shopify → reverse the commission and mark it cancelled.
      if (o.cancelledAt) await processCancelledOrder(payload);
      processedIds.push(numericId);
    }
    if (!conn.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/affiliate-orders");
  revalidatePath("/admin/commissions");

  if (processedIds.length === 0) {
    return { ok: true, message: `Scanned ${scanned} recent orders — none used an affiliate code.` };
  }

  // Report the outcome per order so the reason is visible immediately.
  const outcomes = await db
    .select({ n: orders.orderNumber, status: orders.attributionStatus })
    .from(orders)
    .where(inArray(orders.shopifyOrderId, processedIds));
  const attributed = outcomes.filter((o) => o.status?.startsWith("attributed")).length;
  const skipped = outcomes.filter((o) => !o.status?.startsWith("attributed"));
  const reasons = skipped
    .slice(0, 4)
    .map((o) => `${o.n}: ${o.status ?? "not attributed"}`)
    .join(" · ");
  const tail = skipped.length ? ` Not attributed → ${reasons}${skipped.length > 4 ? " …" : ""}` : "";
  return {
    ok: true,
    message: `Imported ${processedIds.length} affiliate order(s): ${attributed} attributed, ${skipped.length} skipped.${tail}`,
  };
}

function revalAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/commissions");
  revalidatePath("/admin/payouts");
}

// ---------- Affiliates ----------

export async function approveAffiliate(id: string, campaignId?: string): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) });
  if (!aff) return { ok: false, message: "Affiliate not found." };

  await db.update(affiliates).set({ status: "approved" }).where(eq(affiliates.id, id));

  // Assign to the chosen campaign on approval — its config drives the code.
  const campaign = campaignId
    ? await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) })
    : null;
  if (campaign) {
    await db.insert(affiliateCampaigns).values({ affiliateId: id, campaignId: campaign.id }).onConflictDoNothing();
  }

  // Issue a discount code if one doesn't exist yet.
  let shopifyError: string | null = null;
  let issuedCode: string | null = null;
  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, id) });
  if (!existing) {
    const program = aff.programId
      ? await db.query.programs.findFirst({ where: eq(programs.id, aff.programId) })
      : await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
    const cfg = campaign ? mergeConfig(campaign.config) : null;
    const cust = cfg
      ? customerDiscountFromConfig(cfg, program)
      : { value: program && program.commissionType === "percent" ? Number(program.commissionValue) : 15, valueType: "percent" as const };
    let code = await uniqueDiscountCode(`${aff.refCode}${Math.round(cust.value)}`);

    let shopifyDiscountId: string | null = null;
    if (await shopifyReady()) {
      try {
        const options = cfg ? await resolveCampaignDiscountOptions(cfg, campaign!.endsAt) : {};
        if (cfg) options.valueType = cust.valueType;
        const created = await createDiscountWithUniqueCode(code, cust.value, options);
        shopifyDiscountId = created.id;
        code = created.code;
      } catch (e: any) {
        shopifyError = e?.message ?? "Shopify sync failed";
        console.error("[approveAffiliate] Shopify code creation failed:", e);
      }
    }
    issuedCode = code;
    await db
      .insert(discountCodes)
      .values({ affiliateId: id, campaignId: campaign?.id ?? null, code, percentage: cust.value.toString(), shopifyDiscountId, active: true })
      .onConflictDoNothing();
  }

  await notify(
    id,
    "dashboard",
    "You're approved 🎉",
    campaign ? `You're in the ${campaign.name} campaign — grab your link and start earning.` : "Your partner account is active — grab your link and start earning.",
    "/dashboard",
  );

  // Email the affiliate — ONE email (the approved email, naming the campaign).
  const approvedUser = await db.query.users.findFirst({ where: eq(users.id, aff.userId) });
  if (approvedUser?.email) {
    await dispatchEmail("approved", approvedUser.email, {
      name: approvedUser.name ?? "there",
      code: issuedCode ?? "",
      campaign: campaign?.name ?? "",
      loginUrl: `${APP_URL}/login`,
    });
  }

  // Create (or link an existing) Shopify customer for this affiliate.
  if (!aff.shopifyCustomerId && approvedUser?.email) {
    const cid = await upsertShopifyCustomer(approvedUser.email, approvedUser.name);
    if (cid) await db.update(affiliates).set({ shopifyCustomerId: cid }).where(eq(affiliates.id, id));
  }

  revalAdmin();
  // Be honest when the coupon didn't make it into Shopify — it won't work at checkout.
  if (shopifyError) {
    return {
      ok: true,
      message: `Affiliate approved${issuedCode ? ` (code ${issuedCode})` : ""}, but Shopify sync failed: ${shopifyError}. Push the code from Discount Codes.`,
    };
  }
  return { ok: true, message: `Affiliate approved${issuedCode ? ` and code ${issuedCode} issued` : ""}.` };
}

export async function setAffiliateStatus(
  id: string,
  status: "approved" | "rejected" | "suspended" | "pending",
  campaignId?: string,
): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  if (status === "approved") return approveAffiliate(id, campaignId);
  await db.update(affiliates).set({ status }).where(eq(affiliates.id, id));
  revalAdmin();
  return { ok: true, message: `Affiliate ${status}.` };
}

/**
 * Permanently remove an affiliate and everything tied to them — distinct from
 * "suspend" (which keeps them on the list). Their Shopify discount codes are
 * deleted in Shopify too so no dead code lingers at checkout, then all
 * affiliate-owned rows are removed in FK-safe order inside one transaction, and
 * finally the login user. Financial batches (payouts) are kept; only THIS
 * affiliate's items/commissions are removed from them.
 */
export async function deleteAffiliate(id: string): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) });
  if (!aff) return { ok: false, message: "Affiliate not found." };

  // Best-effort: delete their live Shopify discounts so codes stop working.
  if (await shopifyReady()) {
    const codes = await db.query.discountCodes.findMany({ where: eq(discountCodes.affiliateId, id) });
    for (const c of codes) {
      if (c.shopifyDiscountId) {
        try { await deleteDiscountInShopify(c.shopifyDiscountId); } catch (e) { console.error("[deleteAffiliate] shopify code", e); }
      }
    }
  }

  try {
    await db.transaction(async (tx) => {
      await tx.delete(pollVotes).where(eq(pollVotes.affiliateId, id));
      await tx.delete(groupMessageReads).where(eq(groupMessageReads.affiliateId, id));
      await tx.delete(directMessages).where(eq(directMessages.affiliateId, id));
      await tx.delete(notifications).where(eq(notifications.affiliateId, id));
      await tx.delete(posts).where(eq(posts.affiliateId, id));
      await tx.delete(discoveredPosts).where(eq(discoveredPosts.affiliateId, id));
      await tx.delete(clicks).where(eq(clicks.affiliateId, id));
      await tx.delete(sampleRequests).where(eq(sampleRequests.affiliateId, id));
      await tx.delete(discountCodes).where(eq(discountCodes.affiliateId, id));
      await tx.delete(affiliateCampaigns).where(eq(affiliateCampaigns.affiliateId, id));
      await tx.delete(groupMembers).where(eq(groupMembers.affiliateId, id));
      await tx.delete(payoutItems).where(eq(payoutItems.affiliateId, id));
      await tx.delete(commissions).where(eq(commissions.affiliateId, id));
      await tx.delete(affiliates).where(eq(affiliates.id, id));
      if (aff.userId) {
        // passwordResetTokens.user_id is NOT NULL → must go before the user.
        await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, aff.userId));
        await tx.delete(users).where(eq(users.id, aff.userId));
      }
    });
  } catch (e) {
    console.error("[deleteAffiliate]", e);
    return { ok: false, message: "Couldn't remove this affiliate — see logs." };
  }

  revalAdmin();
  return { ok: true, message: "Affiliate removed." };
}

/** Admin edit of an affiliate's contact/payout info (name, email, phone, address, PayPal). */
export async function updateAffiliateInfo(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      name: z.string().min(1, "Enter a name"),
      email: z.string().email("Enter a valid email"),
      phone: z.string().optional(),
      addressLine1: z.string().optional(),
      addressLine2: z.string().optional(),
      city: z.string().optional(),
      region: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
      paypalEmail: z.string().email().optional().or(z.literal("")),
      companyName: z.string().optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, id) });
  if (!aff) return { ok: false, message: "Affiliate not found." };

  const newEmail = d.email.toLowerCase().trim();
  const clash = await db.query.users.findFirst({ where: eq(users.email, newEmail) });
  if (clash && clash.id !== aff.userId) return { ok: false, message: "That email is already in use." };

  const phone = d.phone && d.phone.trim() ? normalizePhone(d.phone) : null;
  if (d.phone && d.phone.trim() && !phone) return { ok: false, message: "Enter a valid phone number." };
  const phoneChanged = (phone ?? null) !== (aff.phone ?? null);

  const addr = normalizeAddress(d);
  const composed = composeAddress(addr);

  await db.update(users).set({ name: d.name, email: newEmail }).where(eq(users.id, aff.userId));
  await db
    .update(affiliates)
    .set({
      phone,
      ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
      address: composed || null,
      addressLine1: addr.line1 || null,
      addressLine2: addr.line2 || null,
      city: addr.city || null,
      region: addr.region || null,
      postalCode: addr.postalCode || null,
      country: addr.country || null,
      paypalEmail: d.paypalEmail?.trim().toLowerCase() || null,
      companyName: d.companyName?.trim() || null,
    })
    .where(eq(affiliates.id, id));
  revalidatePath(`/admin/affiliates/${id}`);
  revalidatePath("/admin/affiliates");
  return { ok: true, message: "Affiliate info updated." };
}

export async function assignProgram(affiliateId: string, programId: string): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(affiliates).set({ programId }).where(eq(affiliates.id, affiliateId));
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  return { ok: true, message: "Program reassigned." };
}

// ---------- Commissions ----------

export async function approveCommissions(ids: string[]): Promise<ActionResult> {
  await assertAdmin("commissions");
  if (!db || ids.length === 0) return { ok: false, message: "Nothing to approve." };
  // Only PENDING commissions can be approved. A `reversed` row is a refund
  // clawback — re-approving it would resurrect money that was already clawed
  // back (and, if flagged, wipe the fraud flag). Restoring a reversed
  // commission must be an explicit, separate action, never a bulk approve.
  // Clearing the flag is intentional here: approving a pending row is the
  // explicit human review that clears it.
  const rows = await db
    .update(commissions)
    .set({ status: "approved", flagged: false })
    .where(and(inArray(commissions.id, ids), eq(commissions.status, "pending")))
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
  // Automatic payout mode (per-campaign, else global): approved money goes out now.
  const paid = await maybeAutoPayout(affIds);
  revalAdmin();
  return { ok: true, message: `${rows.length} commission(s) approved.${paid ? " " + paid : ""}` };
}

export async function reverseCommissions(ids: string[]): Promise<ActionResult> {
  await assertAdmin("commissions");
  if (!db || ids.length === 0) return { ok: false, message: "Nothing to reverse." };
  // Only pending/approved commissions can be reversed — paid ones are settled.
  const rows = await db
    .update(commissions)
    .set({ status: "reversed", flagged: false })
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
  payoutMinimum: z.coerce.number().nonnegative().default(0),
  newCustomerOnly: z.coerce.boolean().default(false),
});

export async function createProgram(input: unknown): Promise<ActionResult> {
  await assertAdmin("programs");
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
    payoutMinimum: d.payoutMinimum.toString(),
    newCustomerOnly: d.newCustomerOnly,
    isDefault: Number(count[0]?.c ?? 0) === 0,
  });
  revalidatePath("/admin/programs");
  return { ok: true, message: "Program created." };
}

export async function updateProgram(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin("programs");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = programSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  await db
    .update(programs)
    .set({
      name: d.name,
      commissionType: d.commissionType,
      commissionValue: d.commissionValue.toString(),
      cookieWindowDays: d.cookieWindowDays,
      holdDays: d.holdDays,
      payoutMinimum: d.payoutMinimum.toString(),
      newCustomerOnly: d.newCustomerOnly,
    })
    .where(eq(programs.id, id));
  revalidatePath("/admin/programs");
  revalidatePath("/admin/payouts");
  return { ok: true, message: "Program updated." };
}

export async function setDefaultProgram(id: string): Promise<ActionResult> {
  await assertAdmin("programs");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(programs).set({ isDefault: false });
  await db.update(programs).set({ isDefault: true }).where(eq(programs.id, id));
  revalidatePath("/admin/programs");
  return { ok: true, message: "Default program updated." };
}

export async function deleteProgram(id: string): Promise<ActionResult> {
  await assertAdmin("programs");
  if (!db) return { ok: false, message: "Database not configured." };
  const prog = await db.query.programs.findFirst({ where: eq(programs.id, id) });
  if (!prog) return { ok: false, message: "Program not found." };
  if (prog.isDefault) return { ok: false, message: "You can't delete the default program. Set another default first." };
  // Move affiliates on this program back to the default; keep their commissions.
  const def = await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
  await db.update(affiliates).set({ programId: def?.id ?? null }).where(eq(affiliates.programId, id));
  await db.delete(programs).where(eq(programs.id, id));
  revalidatePath("/admin/programs");
  return { ok: true, message: "Program deleted. Its affiliates moved to the default program." };
}

// ---------- Groups ----------

export async function createGroup(input: unknown): Promise<ActionResult> {
  await assertAdmin("messages");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z.object({ name: z.string().min(2), description: z.string().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Enter a group name." };
  await db.insert(groups).values({ name: parsed.data.name, description: parsed.data.description || null });
  revalidatePath("/admin/groups");
  return { ok: true, message: "Group created." };
}

/** Post a message (text / attachments / poll) to a group's chat. */
export async function sendGroupMessage(groupId: string, input: unknown): Promise<ActionResult> {
  await assertAdmin("messages");
  const senderId = ((await auth())?.user as any)?.id ?? null;
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      body: z.string().max(4000).optional().default(""),
      attachments: z
        .array(z.object({ type: z.string(), url: z.string().url(), name: z.string().optional() }))
        .optional()
        .default([]),
      poll: z
        .object({ question: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(8) })
        .nullable()
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid message." };
  const d = parsed.data;
  if (!d.body.trim() && (!d.attachments || d.attachments.length === 0) && !d.poll) {
    return { ok: false, message: "Add a message, attachment, or poll." };
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) return { ok: false, message: "Group not found." };

  await db.insert(groupMessages).values({
    groupId,
    senderId,
    body: d.body.trim() || null,
    attachments: d.attachments && d.attachments.length ? d.attachments : null,
    poll: d.poll ?? null,
  });

  // Notify every affiliate in the group (their unread badge lights up).
  const members = await db.select({ id: affiliates.id }).from(affiliates).where(eq(affiliates.groupId, groupId));
  for (const m of members) {
    await notify(m.id, "community", `New message in ${group.name}`, d.poll ? d.poll.question : d.body.slice(0, 80) || "Shared an attachment", "/community");
  }
  revalidatePath("/admin/groups");
  revalidatePath(`/admin/groups/${groupId}`);
  return { ok: true, message: "Message sent to the group." };
}

export async function updateGroup(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin("messages");
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
  await assertAdmin("messages");
  if (!db) return { ok: false, message: "Database not configured." };
  // Detach members first (their group_id references this group).
  await db.update(affiliates).set({ groupId: null }).where(eq(affiliates.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
  revalidatePath("/admin/groups");
  return { ok: true, message: "Group deleted." };
}

export async function setAffiliateGroup(affiliateId: string, groupId: string | null): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(affiliates).set({ groupId }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/admin/groups");
  if (groupId) revalidatePath(`/admin/groups/${groupId}`);
  return { ok: true, message: groupId ? "Added to group." : "Removed from group." };
}

// ---------- Promotions ----------

export async function createPromotion(input: unknown): Promise<ActionResult> {
  await assertAdmin("promotions");
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
  await assertAdmin("messages");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      subject: z.string().min(1),
      body: z.string().min(1),
      status: z.array(z.string()).optional(),
      groupIds: z.array(z.string()).optional(),
      affiliateIds: z.array(z.string()).optional(),
      ctaText: z.string().optional(),
      ctaUrl: z.string().url().optional().or(z.literal("")),
      imageUrl: z.string().url().optional().or(z.literal("")),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Add a subject and message." };
  const { subject, body, status, groupIds, affiliateIds, ctaText, ctaUrl, imageUrl } = parsed.data;

  // Target specific affiliates, or group members, or a set of statuses (default: approved).
  let where;
  if (affiliateIds?.length) {
    where = inArray(affiliates.id, affiliateIds as any);
  } else if (groupIds?.length) {
    const mem = await db.select({ id: groupMembers.affiliateId }).from(groupMembers).where(inArray(groupMembers.groupId, groupIds as any));
    const ids = [...new Set(mem.map((m) => m.id))];
    if (!ids.length) return { ok: false, message: "That group has no members yet." };
    where = inArray(affiliates.id, ids);
  } else if (status?.length) {
    where = inArray(affiliates.status, status as any);
  } else {
    where = eq(affiliates.status, "approved");
  }

  const recipients = await db
    .select({ id: affiliates.id, email: users.email, name: users.name, prefs: affiliates.notificationPrefs })
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
    audience: (affiliateIds?.length ? { affiliateIds } : groupIds?.length ? { groupIds } : { status: status ?? ["approved"] }) as any,
    recipientCount: recipients.length,
    sentAt: new Date(),
  });

  // A broadcast to a single group also lands in that group's chat feed, so the
  // Community group chat and broadcasts stay in sync (one place to look).
  if (groupIds?.length === 1 && !affiliateIds?.length) {
    const senderId = ((await auth())?.user as any)?.id ?? null;
    await db.insert(groupMessages).values({ groupId: groupIds[0], senderId, body: `${subject}\n\n${body}` });
  }

  if (await emailReady()) {
    // In-app notification goes to everyone; email respects the "Program updates" opt-out.
    await sendRichBroadcast(
      recipients
        .filter((r) => r.email && (r.prefs as Record<string, boolean> | null)?.programUpdates !== false)
        .map((r) => ({ email: r.email!, name: r.name ?? undefined })),
      subject,
      body,
      {
        cta: ctaText && ctaUrl ? { text: ctaText, url: ctaUrl } : undefined,
        imageUrl: imageUrl || undefined,
      },
    );
  }

  revalidatePath("/admin/messages");
  revalidatePath("/community");
  return { ok: true, message: `Message sent to ${recipients.length} affiliate(s).` };
}

// ---------- Bulk discount codes ----------

export async function bulkCreateDiscounts(percent: number, prefix = ""): Promise<ActionResult> {
  await assertAdmin("codes");
  if (!db) return { ok: false, message: "Database not configured." };
  const approved = await db.query.affiliates.findMany({ where: eq(affiliates.status, "approved") });
  const shopifyOn = await shopifyReady();
  let created = 0;
  let shopifyFailed = 0;
  for (const aff of approved) {
    // Skip affiliates who already have a code.
    if (await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, aff.id) })) continue;
    const code = await uniqueDiscountCode(`${prefix}${aff.refCode}${percent}`);
    let shopifyDiscountId: string | null = null;
    if (shopifyOn) {
      try {
        shopifyDiscountId = await createDiscountForAffiliate(code, percent);
      } catch (e) {
        shopifyFailed++;
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
  const note = shopifyFailed ? ` (${shopifyFailed} failed to sync to Shopify — push them individually)` : "";
  return { ok: shopifyFailed === 0, message: `Created ${created} discount code(s)${note}.` };
}

/** Create one discount code for a single affiliate (also pushes to Shopify when connected). */
export async function createSingleDiscount(input: unknown): Promise<ActionResult> {
  await assertAdmin("codes");
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
  await assertAdmin("codes");
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
  await assertAdmin("codes");
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
  await assertAdmin("codes");
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

/** Make every Shopify-linked code stackable (fixes codes a VIP couldn't use). */
export async function makeAllCodesCombinable(): Promise<ActionResult> {
  await assertAdmin("codes");
  if (!db) return { ok: false, message: "Database not configured." };
  if (!(await shopifyReady())) return { ok: false, message: "Connect Shopify first (Settings → Integrations)." };
  const codes = await db.select().from(discountCodes).where(isNotNull(discountCodes.shopifyDiscountId));
  let ok = 0;
  let failed = 0;
  for (const c of codes) {
    try {
      await makeDiscountCombinable(c.shopifyDiscountId!);
      ok++;
    } catch (e) {
      console.error("[makeAllCodesCombinable]", c.code, e);
      failed++;
    }
    await new Promise((r) => setTimeout(r, 400)); // respect Shopify rate limits
  }
  revalidatePath("/admin/codes");
  return { ok: true, message: `Updated ${ok} code(s) to stack with other discounts${failed ? `, ${failed} failed` : ""}.` };
}

/** Push a local-only code up to Shopify (for codes created before Shopify was connected). */
export async function pushDiscountToShopify(id: string): Promise<ActionResult> {
  await assertAdmin("codes");
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
// The payout ENGINE lives in lib/payouts.ts (a plain module, so it is NOT
// exposed as a callable endpoint). The only things exported from here are
// admin-gated wrappers. Cron and the payouts server page import the engine
// directly.

/** Admin-gated: refresh one batch's status from PayPal (used by the client refresh button). */
export async function reconcilePayout(payoutId: string): Promise<{ ok: boolean; status?: string; message?: string }> {
  await assertAdmin("payouts");
  return reconcilePayoutCore(payoutId);
}

export async function runCustomPayout(input: unknown): Promise<ActionResult> {
  await assertAdmin("payouts");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({ affiliateId: z.string().min(1), amount: z.coerce.number().positive("Enter an amount") })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const { affiliateId, amount } = parsed.data;

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  if (!aff) return { ok: false, message: "Affiliate not found." };
  const method = aff.payoutMethod;
  // Venmo requires a VERIFIED phone — never send money to an unverified number.
  const receiver = method === "venmo" ? (aff.phoneVerifiedAt ? aff.phone : null) : aff.paypalEmail;
  if (!receiver) {
    return {
      ok: false,
      message: method === "venmo" ? "This affiliate has no verified Venmo phone on file." : "This affiliate has no PayPal email on file.",
    };
  }
  // Never fake a payout: if PayPal isn't connected, no money can move.
  if (!(await paypalReady())) return { ok: false, message: "Connect PayPal first (Settings → Integrations)." };

  // Pay in the currency this affiliate actually earns in — hardcoding USD sent a
  // USD item (and USD receipt) to EUR affiliates. Use their latest commission's
  // currency, falling back to USD when they have no history yet.
  const [lastComm] = await db
    .select({ currency: commissions.currency })
    .from(commissions)
    .where(eq(commissions.affiliateId, affiliateId))
    .orderBy(desc(commissions.createdAt))
    .limit(1);
  const currency = lastComm?.currency ?? "USD";

  const batchId = crypto.randomUUID();
  const senderBatchId = `CUSTOM-${batchId}`;
  const [batch] = await db
    .insert(payouts)
    .values({ id: batchId, senderBatchId, status: "processing", totalAmount: amount.toFixed(2), affiliateCount: 1 })
    .returning();
  const [item] = await db
    .insert(payoutItems)
    .values({ payoutId: batch.id, affiliateId, amount: amount.toFixed(2), currency, transactionStatus: "PENDING" })
    .returning();

  try {
    const res = await createPayoutBatch(senderBatchId, [
      { senderItemId: item.id, amount: amount.toFixed(2), receiver, method, currency },
    ]);
    await db.update(payouts).set({ paypalBatchId: res.payoutBatchId }).where(eq(payouts.id, batch.id));
  } catch (e) {
    console.error("[runCustomPayout] PayPal error:", e);
    await db.update(payouts).set({ status: "failed" }).where(eq(payouts.id, batch.id));
    return { ok: false, message: "PayPal payout failed — see logs." };
  }

  // Pull PayPal's current state so a fast-completing payout shows "Paid out"
  // right away instead of sitting on "Processing" (best-effort; webhook + the
  // page-load reconcile will catch up if PayPal is still processing).
  await reconcilePayoutCore(batch.id).catch(() => {});

  await notify(
    affiliateId,
    "payouts",
    "Payout sent 💸",
    `A payout of $${amount.toFixed(2)} is on its way to you.`,
    "/payouts",
  );
  const payoutUser = await db.query.users.findFirst({ where: eq(users.id, aff.userId) });
  if (payoutUser?.email && (aff.notificationPrefs as Record<string, boolean> | null)?.payoutSent !== false) {
    await dispatchEmail("payout_sent", payoutUser.email, { name: payoutUser.name ?? "there", amount: amount.toFixed(2), currency });
  }
  revalAdmin();
  return { ok: true, message: `Custom payout of $${amount.toFixed(2)} submitted.` };
}

export async function runPayout(): Promise<ActionResult> {
  await assertAdmin("payouts");
  const r = await executePayout();
  revalAdmin();
  return r;
}

/**
 * Manual "Pay now": pays every approved affiliate right away, ignoring the
 * payout minimum (the admin is explicitly choosing to pay). Only the minimum is
 * bypassed — a valid payout destination and PayPal are still required.
 */
export async function payNowAll(): Promise<ActionResult> {
  await assertAdmin("payouts");
  const r = await executePayout(undefined, { ignoreMinimum: true });
  revalAdmin();
  return r;
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
  phoneRaw?: string,
  address?: string,
  campaignId?: string,
): Promise<InviteOutcome> {
  email = email.toLowerCase().trim();
  const existing = await db!.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { email, ok: false, emailed: false, error: "Already exists" };

  // Optionally enroll into a specific campaign — its config drives the code.
  const campaign = campaignId
    ? await db!.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) })
    : null;

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
  // The discount reflects the campaign's config when inviting into one; otherwise
  // the program rate (falling back to 15%).
  const cfg = campaign ? mergeConfig(campaign.config) : null;
  const cust = cfg
    ? customerDiscountFromConfig(cfg, program)
    : { value: program && program.commissionType === "percent" ? Number(program.commissionValue) : 15, valueType: "percent" as const };
  let code = cleanCode || `${refCode}${Math.round(cust.value)}`.toUpperCase();

  const phone = phoneRaw && phoneRaw.trim() ? normalizePhone(phoneRaw) : null;
  // Invited affiliates are approved on the spot — link them to Shopify now.
  const shopifyCustomerId = await upsertShopifyCustomer(email, name || null);
  const [aff] = await db!
    .insert(affiliates)
    .values({ userId: user.id, status: "approved", refCode, paypalEmail: null, phone, address: address?.trim() || null, programId: program?.id ?? null, shopifyCustomerId })
    .returning();

  // Enroll into the chosen campaign.
  if (campaign) {
    await db!.insert(affiliateCampaigns).values({ affiliateId: aff.id, campaignId: campaign.id }).onConflictDoNothing();
  }

  // Issue the discount code (create in Shopify only if it's a freshly generated one;
  // imported codes are assumed to already exist in the store).
  let shopifyDiscountId: string | null = null;
  if (!existingCode && (await shopifyReady())) {
    try {
      const options = cfg ? await resolveCampaignDiscountOptions(cfg, campaign!.endsAt) : {};
      if (cfg) options.valueType = cust.valueType;
      const created = await createDiscountWithUniqueCode(code, cust.value, options);
      shopifyDiscountId = created.id;
      code = created.code;
    } catch (e) {
      console.error("[invite] shopify code:", e);
    }
  }
  await db!
    .insert(discountCodes)
    .values({ affiliateId: aff.id, campaignId: campaign?.id ?? null, code, percentage: cust.value.toString(), shopifyDiscountId, active: true })
    .onConflictDoNothing();

  // Send the invite email using the chosen (or default) template.
  let emailed = false;
  const tpl = templateId
    ? await db!.query.inviteTemplates.findFirst({ where: eq(inviteTemplates.id, templateId) })
    : await defaultTemplate();
  if (tpl && (await emailReady())) {
    const vars = { name: name || "there", code, campaign: campaign?.name ?? "", loginUrl: `${APP_URL}/login`, link: `${APP_URL}/api/track?ref=${refCode}`, tempPassword };
    try {
      const r = await renderBrandedEmail(tpl.subject, tpl.body, vars);
      await sendEmail(email, r.subject, r.html);
      emailed = true;
    } catch (e) {
      console.error("[invite] email:", e);
    }
  }

  return { email, ok: true, emailed, tempPassword, code };
}

export async function inviteAffiliate(input: unknown): Promise<ActionResult & { tempPassword?: string; emailed?: boolean }> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      name: z.string().optional(),
      email: z.string().email(),
      code: z.string().optional(),
      templateId: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      // Required: nobody joins Sipfluence without a campaign.
      campaignId: z.string().min(1, "Pick a campaign to add them to."),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Enter a valid email." };
  const res = await createAndInvite(parsed.data.name ?? "", parsed.data.email, parsed.data.templateId, parsed.data.code, parsed.data.phone, parsed.data.address, parsed.data.campaignId);
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
  campaignId?: string,
): Promise<ActionResult & { created: number; emailed: number; skipped: number }> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured.", created: 0, emailed: 0, skipped: 0 };
  if (!campaignId) return { ok: false, message: "Pick a campaign to add them to.", created: 0, emailed: 0, skipped: 0 };
  const clean = (rows ?? []).filter((r) => /.+@.+\..+/.test(r.email ?? ""));
  let created = 0,
    emailed = 0,
    skipped = 0;
  for (const r of clean) {
    const res = await createAndInvite(r.name ?? "", r.email, templateId, r.code, undefined, undefined, campaignId);
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
  await assertAdmin("affiliates");
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
        const r = await renderBrandedEmail(tpl.subject, tpl.body, vars);
        await sendEmail(user.email, r.subject, r.html);
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
  await assertAdmin("settings");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = tplSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const count = await db.select({ c: sql<number>`count(*)` }).from(inviteTemplates);
  await db.insert(inviteTemplates).values({ ...parsed.data, isDefault: Number(count[0]?.c ?? 0) === 0 });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template created." };
}

export async function updateInviteTemplate(id: string, input: unknown): Promise<ActionResult> {
  await assertAdmin("settings");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = tplSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  await db.update(inviteTemplates).set(parsed.data).where(eq(inviteTemplates.id, id));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template updated." };
}

export async function deleteInviteTemplate(id: string): Promise<ActionResult> {
  await assertAdmin("settings");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.delete(inviteTemplates).where(eq(inviteTemplates.id, id));
  revalidatePath("/admin/settings");
  return { ok: true, message: "Template deleted." };
}

export async function setDefaultInviteTemplate(id: string): Promise<ActionResult> {
  await assertAdmin("settings");
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
  await assertAdmin("campaigns");
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
  await assertAdmin("campaigns");
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
  await assertAdmin("settings");
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
  await assertAdmin("campaigns");
  if (!db) return { ok: false, message: "Database not configured." };
  if (!config || typeof config !== "object") return { ok: false, message: "Invalid config." };
  // Keep the top-level reward columns (shown on the campaigns list, overview
  // KPIs, join page and chat invites) in sync with what's saved in the config,
  // so editing the amount here updates everywhere — not just attribution.
  const cfg = mergeConfig(config);
  const toColType = (t: string) => (t === "percent" ? "percent" : "flat");
  await db
    .update(campaigns)
    .set({
      config: config as any,
      rewardType: toColType(cfg.reward.valueType) as any,
      rewardValue: String(cfg.reward.value ?? 0),
      friendRewardType: toColType(cfg.friend.valueType) as any,
      friendRewardValue: String(cfg.friend.kind === "none" ? 0 : cfg.friend.value ?? 0),
    })
    .where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin/campaigns");
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (c?.slug) revalidatePath(`/join/${c.slug}`);
  return { ok: true, message: "Rewards & rules saved." };
}

/** Save the per-campaign theme (merged into the campaign's config JSON). */
/** Save which extra fields a campaign's /join signup form collects. */
export async function saveCampaignSignup(id: string, signup: unknown): Promise<ActionResult> {
  await assertAdmin("campaigns");
  if (!db) return { ok: false, message: "Database not configured." };
  const mode = z.enum(["off", "optional", "required"]).default("optional");
  const parsed = z
    .object({ companyName: mode, channel: mode, audienceSize: mode, handle: mode, address: mode, phone: mode })
    .safeParse(signup);
  if (!parsed.success) return { ok: false, message: "Invalid signup fields." };
  const current = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!current) return { ok: false, message: "Campaign not found." };
  const config = { ...mergeConfig(current.config), signup: parsed.data };
  await db.update(campaigns).set({ config: config as any }).where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  if (current.slug) revalidatePath(`/join/${current.slug}`);
  return { ok: true, message: "Signup fields saved." };
}

export async function saveCampaignTheme(id: string, brand: unknown): Promise<ActionResult> {
  await assertAdmin("campaigns");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      enabled: z.coerce.boolean().default(false),
      logoText: z.string().max(60).optional().default(""),
      logoImage: z.string().max(2_600_000).optional().default(""),
      primaryColor: z.string().max(9).optional().default("#FF5C9E"),
      accentColor: z.string().max(9).optional().default("#FFC94D"),
      backgroundColor: z.string().max(9).optional().default(""),
      heroImage: z.string().max(2_600_000).optional().default(""),
      headline: z.string().max(120).optional().default(""),
      subtext: z.string().max(400).optional().default(""),
      approvedMessage: z.string().max(400).optional().default(""),
    })
    .safeParse(brand);
  if (!parsed.success) return { ok: false, message: "Invalid theme." };
  const current = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!current) return { ok: false, message: "Campaign not found." };
  const config = { ...mergeConfig(current.config), brand: parsed.data };
  await db.update(campaigns).set({ config: config as any }).where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  if (current.slug) revalidatePath(`/join/${current.slug}`);
  return { ok: true, message: parsed.data.enabled ? "Theme saved." : "Theme saved — using the global brand until enabled." };
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
  paypal: ["int_paypal_base", "int_paypal_client_id", "int_paypal_client_secret", "int_paypal_webhook_id"],
  email: ["int_email_from", "int_resend_key"],
  sms: ["int_sms_account_sid", "int_sms_secret", "int_sms_verify_service", "int_sms_provider", "int_sms_from", "int_sms_key"],
};

export async function saveIntegration(service: string, fields: Record<string, string>): Promise<ActionResult> {
  await assertAdmin("settings");
  if (!db) return { ok: false, message: "Database not configured." };
  if (service === "shopify") {
    if (fields.domain !== undefined) await writeSetting("int_shopify_domain", fields.domain.trim());
    if (fields.version !== undefined) await writeSetting("int_shopify_version", fields.version.trim() || "2025-07");
    await writeSecret("int_shopify_token", fields.token ?? "");
    await writeSecret("int_shopify_secret", fields.apiSecret ?? "");
  } else if (service === "paypal") {
    if (fields.base !== undefined) await writeSetting("int_paypal_base", fields.base.trim());
    if (fields.webhookId !== undefined) await writeSetting("int_paypal_webhook_id", fields.webhookId.trim());
    await writeSecret("int_paypal_client_id", fields.clientId ?? "");
    await writeSecret("int_paypal_client_secret", fields.clientSecret ?? "");
  } else if (service === "email") {
    if (fields.from !== undefined) await writeSetting("int_email_from", fields.from.trim());
    await writeSecret("int_resend_key", fields.apiKey ?? "");
  } else if (service === "sms") {
    // Twilio Verify: Account SID + Auth Token + Verify Service SID (no sender number).
    if (fields.accountSid !== undefined) await writeSetting("int_sms_account_sid", fields.accountSid.trim());
    if (fields.verifyServiceSid !== undefined) await writeSetting("int_sms_verify_service", fields.verifyServiceSid.trim());
    await writeSecret("int_sms_secret", fields.authToken ?? "");
  } else {
    return { ok: false, message: "Unknown integration." };
  }
  revalidatePath("/admin/settings/integrations");
  return { ok: true, message: `${service.charAt(0).toUpperCase() + service.slice(1)} connection saved.` };
}

/** Save which products affiliates see in the catalog, and in what order. */
export async function saveCatalogConfig(input: unknown): Promise<ActionResult> {
  await assertAdmin("promotions");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({ order: z.array(z.string()), shown: z.array(z.string()) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid catalog settings." };
  await writeSetting("catalog_config", JSON.stringify(parsed.data));
  revalidatePath("/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Catalog updated." };
}

/** The collection-aware visibility rules for the affiliate product catalog. */
export async function saveCatalogVisibility(input: unknown): Promise<ActionResult> {
  await assertAdmin("promotions");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      allowedCollections: z.array(z.string()).default([]),
      allowedProducts: z.array(z.string()).default([]),
      hiddenProducts: z.array(z.string()).default([]),
      featured: z.array(z.string()).default([]),
      order: z.array(z.string()).default([]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid catalog settings." };
  await writeSetting("catalog_visibility", JSON.stringify(parsed.data));
  revalidatePath("/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Catalog visibility updated." };
}

/**
 * Which products affiliates can request as samples (and their order). Every
 * promo-visible product is sample-able by default; `hidden` is the opt-out list
 * of ids the admin has switched off, so new products stay sample-able.
 */
export async function saveSamplesConfig(input: unknown): Promise<ActionResult> {
  await assertAdmin("samples");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z.object({ order: z.array(z.string()), hidden: z.array(z.string()) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid samples settings." };
  await writeSetting("samples_catalog_config", JSON.stringify(parsed.data));
  revalidatePath("/samples");
  revalidatePath("/admin/samples");
  return { ok: true, message: "Sample catalog updated." };
}

/** Save (or clear) the promo banner shown on the samples or promotions page. */
export async function saveBanner(placement: "samples" | "promotions", input: unknown): Promise<ActionResult> {
  await assertAdmin(placement === "samples" ? "samples" : "promotions");
  if (!db) return { ok: false, message: "Database not configured." };
  if (placement !== "samples" && placement !== "promotions") return { ok: false, message: "Unknown banner." };
  const parsed = z
    .object({
      enabled: z.coerce.boolean().default(false),
      title: z.string().max(120).optional().default(""),
      body: z.string().max(400).optional().default(""),
      ctaLabel: z.string().max(40).optional().default(""),
      ctaUrl: z.string().max(500).optional().default(""),
      // Images are uploaded as base64 data URLs (the client caps files at
      // ~1.8MB), so this must comfortably exceed a plain URL length.
      imageUrl: z.string().max(2_600_000).optional().default(""),
      imageUrlMobile: z.string().max(2_600_000).optional().default(""),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid banner." };
  await writeSetting(`banner_${placement}`, JSON.stringify(parsed.data));
  revalidatePath(placement === "samples" ? "/samples" : "/promotions");
  revalidatePath(`/admin/${placement}`);
  return { ok: true, message: parsed.data.enabled ? "Banner saved." : "Banner hidden." };
}

/** Ban / unban an affiliate from requesting product samples. */
export async function setSamplesBanned(affiliateId: string, banned: boolean): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(affiliates).set({ samplesBanned: banned }).where(eq(affiliates.id, affiliateId));
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  revalidatePath("/admin/samples");
  return { ok: true, message: banned ? "Affiliate can no longer request samples." : "Sample requests re-enabled." };
}

/** Mark all current Shopify products & collections as "seen" (clears the new-item dot). */
export async function markCatalogSeen(): Promise<void> {
  await assertAdmin("promotions");
  if (!db) return;
  const ids = await getCatalogItemIds();
  await writeSetting("catalog_seen_products", JSON.stringify(ids.products));
  await writeSetting("catalog_seen_collections", JSON.stringify(ids.collections));
}

/** Save which collections affiliates see, and in what order. */
export async function saveCollectionConfig(input: unknown): Promise<ActionResult> {
  await assertAdmin("promotions");
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z.object({ order: z.array(z.string()), shown: z.array(z.string()) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid collection settings." };
  await writeSetting("collection_config", JSON.stringify(parsed.data));
  revalidatePath("/promotions");
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Collections updated." };
}

/** Ping Shopify with the saved credentials so admins can verify the token works. */
export async function testShopifyConnection(): Promise<ActionResult> {
  await assertAdmin("settings");
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

/** Send a real Twilio Verify code so the admin can confirm the setup works. */
export async function testSms(phoneRaw: string): Promise<ActionResult> {
  await assertAdmin("settings");
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, message: "Enter a valid phone number to test." };
  const res = await sendVerification(phone);
  if (res.simulated) return { ok: false, message: "Twilio Verify isn't connected — enter the credentials and save first." };
  if (!res.sent) return { ok: false, message: `SMS failed: ${res.error ?? "unknown error"}` };
  return { ok: true, message: `Verification code sent to ${phone} — check the phone.` };
}

/** Send a test email so the admin can confirm Resend + the from-address work. */
export async function testEmail(to: string): Promise<ActionResult> {
  await assertAdmin("settings");
  const address = (to ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return { ok: false, message: "Enter a valid email to test." };
  if (!(await emailReady())) return { ok: false, message: "Connect Resend (add an API key) first." };
  try {
    const body = "This is a test email from Sipfluence. If you're reading this, transactional email is working. 🎉";
    const r = await renderBrandedEmail("Sipfluence test email", body);
    const res: any = await sendEmail(address, r.subject, r.html);
    if (res?.skipped) return { ok: false, message: "Email is not connected." };
    return { ok: true, message: `Test email sent to ${address}.` };
  } catch (e: any) {
    return { ok: false, message: `Email failed: ${e?.message ?? "unknown error"}` };
  }
}

export async function disconnectIntegration(service: string): Promise<ActionResult> {
  await assertAdmin("settings");
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
  await assertAdmin("settings");
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
  await assertAdmin("campaigns");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  revalidatePath(`/admin/campaigns/${id}`);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: `Campaign ${status}.` };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  await assertAdmin("campaigns");
  if (!db) return { ok: false, message: "Database not configured." };
  await db.delete(affiliateCampaigns).where(eq(affiliateCampaigns.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
  revalidatePath("/admin/campaigns");
  return { ok: true, message: "Campaign deleted." };
}

export async function assignAffiliateToCampaign(affiliateId: string, campaignId: string): Promise<ActionResult> {
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  const existing = await db.query.affiliateCampaigns.findFirst({
    where: and(eq(affiliateCampaigns.affiliateId, affiliateId), eq(affiliateCampaigns.campaignId, campaignId)),
  });
  if (!existing) {
    await db.insert(affiliateCampaigns).values({ affiliateId, campaignId });
    // Let them know they're in — in-app + a Notification-Center email.
    await notifyAddedToCampaign(affiliateId, campaignId);
  }
  revalidatePath(`/admin/campaigns/${campaignId}`);
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  revalidatePath("/admin/campaigns");
  return { ok: true, message: existing ? "Already in this campaign." : "Added to campaign — they've been notified." };
}

/** Notify an affiliate (in-app + the managed "campaign_added" email) that they
 *  were added to a campaign. Best-effort — never blocks the enrollment. */
async function notifyAddedToCampaign(affiliateId: string, campaignId: string): Promise<void> {
  if (!db) return;
  try {
    const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
    if (!campaign || !aff) return;
    await notify(
      affiliateId,
      "dashboard",
      `You're in: ${campaign.name} 🎉`,
      "You've been added to a new campaign. Sign in to grab your code and link.",
      "/dashboard",
    );
    const user = await db.query.users.findFirst({ where: eq(users.id, aff.userId) });
    if (!user?.email) return;
    if ((aff.notificationPrefs as Record<string, boolean> | null)?.campaign_added === false) return;
    // Prefer the campaign-scoped code, else any of theirs.
    const code =
      (await db.query.discountCodes.findFirst({ where: and(eq(discountCodes.affiliateId, affiliateId), eq(discountCodes.campaignId, campaignId)) }))?.code ??
      (await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, affiliateId) }))?.code ??
      aff.refCode;
    await dispatchEmail("campaign_added", user.email, {
      name: user.name ?? "there",
      campaign: campaign.name,
      code,
      loginUrl: `${APP_URL}/login`,
    });
  } catch (e) {
    console.error("[notifyAddedToCampaign]", e);
  }
}

export async function removeAffiliateFromCampaign(affiliateId: string, campaignId: string): Promise<ActionResult> {
  await assertAdmin("affiliates");
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
  await assertAdmin("affiliates");
  if (!db) return { ok: false, message: "Database not configured." };
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length < 3) return { ok: false, message: "Code must be at least 3 characters." };

  // Ensure uniqueness across all codes.
  const clash = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code) });
  if (clash && clash.affiliateId !== affiliateId) return { ok: false, message: "That code is already taken." };

  const existing = await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, affiliateId) });

  // Sync to Shopify so the NEW code actually works at checkout (create a discount
  // for it). Best-effort — surface the failure so the admin can push it manually.
  let shopifyDiscountId = existing?.shopifyDiscountId ?? null;
  let syncNote = "";
  if (await shopifyReady()) {
    try {
      const percent = Number(existing?.percentage ?? 15) || 15;
      shopifyDiscountId = await createDiscountForAffiliate(code, percent);
    } catch (e) {
      console.error("[updateAffiliateCode] Shopify sync failed:", e);
      syncNote = " (Shopify sync failed — push it from the Discount Codes page.)";
    }
  }

  if (existing) {
    await db.update(discountCodes).set({ code, shopifyDiscountId }).where(eq(discountCodes.id, existing.id));
  } else {
    await db.insert(discountCodes).values({ affiliateId, code, shopifyDiscountId, active: true });
  }
  // Keep the ref code aligned so links match the coupon.
  await db.update(affiliates).set({ refCode: code }).where(eq(affiliates.id, affiliateId)).catch(() => {});
  revalidatePath(`/admin/affiliates/${affiliateId}`);
  return { ok: true, message: `Code updated to ${code}.${syncNote}` };
}

// ---------- Sample requests ----------

/** Approve / reject / mark-shipped a sample request. Approve tries to create a
 *  Shopify draft order (best-effort) to the affiliate's address. */
export async function decideSampleRequest(
  id: string,
  action: "approve" | "reject" | "ship",
  tracking?: { carrier?: string; trackingNumber?: string; trackingUrl?: string },
): Promise<ActionResult> {
  await assertAdmin("samples");
  if (!db) return { ok: false, message: "Database not configured." };
  const req = await db.query.sampleRequests.findFirst({ where: eq(sampleRequests.id, id) });
  if (!req) return { ok: false, message: "Request not found." };

  if (action === "reject") {
    await db.update(sampleRequests).set({ status: "rejected", decidedAt: new Date() }).where(eq(sampleRequests.id, id));
    await notify(req.affiliateId, "samples", "Sample request update", `Your ${req.productTitle ?? "sample"} request wasn't approved this time.`, "/samples");
    revalidatePath("/admin/samples");
    revalidatePath("/samples");
    return { ok: true, message: "Request rejected." };
  }

  if (action === "ship") {
    const carrier = tracking?.carrier?.trim() || null;
    const trackingNumber = tracking?.trackingNumber?.trim() || null;
    const trackingUrl = tracking?.trackingUrl?.trim() || null;
    await db
      .update(sampleRequests)
      .set({ status: "shipped", carrier, trackingNumber, trackingUrl, shippedAt: new Date() })
      .where(eq(sampleRequests.id, id));
    const track = trackingNumber ? ` Tracking: ${carrier ? carrier + " " : ""}${trackingNumber}.` : "";
    await notify(req.affiliateId, "samples", "Your sample shipped 📦", `Your ${req.productTitle ?? "sample"} is on its way!${track}`, "/samples");
    revalidatePath("/admin/samples");
    revalidatePath("/samples");
    return { ok: true, message: "Marked as shipped." };
  }

  // approve
  let shopifyOrderId: string | null = null;
  let shopifyNote = "";
  if (await shopifyReady()) {
    try {
      const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, req.affiliateId) });
      const user = aff ? await db.query.users.findFirst({ where: eq(users.id, aff.userId) }) : null;
      shopifyOrderId = await createSampleDraftOrder({
        productTitle: req.productTitle ?? "Product sample",
        affiliateName: user?.name ?? user?.email ?? "affiliate",
        address: req.addressSnapshot ?? null,
        sampleId: req.id,
      });
    } catch (e: any) {
      shopifyNote = ` (Shopify draft order failed: ${e?.message ?? "error"})`;
      console.error("[decideSampleRequest] shopify:", e);
    }
  }
  await db.update(sampleRequests).set({ status: "approved", shopifyOrderId, decidedAt: new Date() }).where(eq(sampleRequests.id, id));
  await notify(req.affiliateId, "samples", "Sample approved 🎁", `Your ${req.productTitle ?? "sample"} request was approved — we'll ship it soon.`, "/samples");
  revalidatePath("/admin/samples");
  revalidatePath("/samples");
  return { ok: true, message: shopifyOrderId ? "Approved — Shopify draft order created." : `Approved.${shopifyNote}` };
}

// --- Social content scan (the daily "AI worker") ---

/** Run the affiliate social-media scan on demand from the admin Content page. */
export async function runSocialScan(): Promise<ActionResult> {
  await assertAdmin("content");
  const { scanAllAffiliates } = await import("@/lib/social-scan");
  try {
    const r = await scanAllAffiliates();
    revalidatePath("/admin/content");
    const parts = [`Scanned ${r.scannedAffiliates} affiliate${r.scannedAffiliates === 1 ? "" : "s"}`, `${r.discovered} new post${r.discovered === 1 ? "" : "s"} found`];
    if (r.skipped.length) parts.push(`skipped ${r.skipped.join(", ")} (no scraper connected)`);
    return { ok: true, message: parts.join(" · ") + "." };
  } catch (e: any) {
    console.error("[runSocialScan]", e);
    return { ok: false, message: e?.message ?? "Scan failed." };
  }
}

/** Keep or dismiss a discovered post from the admin Content feed. */
export async function setDiscoveredStatus(id: string, status: "kept" | "dismissed"): Promise<ActionResult> {
  await assertAdmin("content");
  if (!db) return { ok: false, message: "No database." };
  await db.update(discoveredPosts).set({ status }).where(eq(discoveredPosts.id, id));
  revalidatePath("/admin/content");
  return { ok: true, message: status === "dismissed" ? "Removed from feed." : "Saved." };
}
