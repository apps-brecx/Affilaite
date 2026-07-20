// lib/queries.ts — the data-access seam. Real Drizzle queries against Postgres.
// Everything reflects the database; when there's no data, callers get empty
// results and the UI shows honest empty states. No fabricated numbers.
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";
import {
  affiliates,
  users,
  programs,
  groups,
  groupMessages,
  groupMessageReads,
  pollVotes,
  commissions,
  orders,
  clicks,
  payouts,
  payoutItems,
  discountCodes,
  messages,
  promotions,
  assets,
  inviteTemplates,
  campaigns,
  affiliateCampaigns,
  appSettings,
  sampleRequests,
  directMessages,
} from "@/db/schema";
import type {
  Affiliate,
  Commission,
  Order,
  AffiliateOrder,
  Payout,
  Program,
  Group,
  Message,
  Promotion,
  Asset,
  TimePoint,
  AdminKpis,
  CommissionState,
  Campaign,
  SampleRequest,
  GroupChatMessage,
} from "./types";
import { mergeConfig, mergeBrand, type BrandSettings } from "./campaign-config";
import { PAID_ITEM_STATUSES } from "./paypal";

export const dataSource = isDbConfigured ? "live" : "unconfigured";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const DAY = 86_400_000;

// ---------- Affiliates (with derived stats) ----------

async function affiliateStatMaps(affiliateIds?: string[]) {
  if (!db) return { earn: new Map(), clickCount: new Map(), orderCount: new Map() };
  // Scope to the affiliates we're rendering — an affiliate portal page loads
  // one affiliate and must not aggregate the whole org's commissions/clicks.
  if (affiliateIds && affiliateIds.length === 0) return { earn: new Map(), clickCount: new Map(), orderCount: new Map() };
  const scope = affiliateIds ? inArray(commissions.affiliateId, affiliateIds) : undefined;
  const clickScope = affiliateIds ? inArray(clicks.affiliateId, affiliateIds) : undefined;

  const earnRows = await db
    .select({
      affiliateId: commissions.affiliateId,
      status: commissions.status,
      total: sql<string>`sum(${commissions.amount})`,
      cnt: sql<number>`count(*)`,
    })
    .from(commissions)
    .where(scope)
    .groupBy(commissions.affiliateId, commissions.status);

  const clickRows = await db
    .select({ affiliateId: clicks.affiliateId, cnt: sql<number>`count(*)` })
    .from(clicks)
    .where(clickScope)
    .groupBy(clicks.affiliateId);

  const earn = new Map<string, { pending: number; approved: number; paid: number; orders: number }>();
  for (const r of earnRows) {
    if (!r.affiliateId) continue;
    const e = earn.get(r.affiliateId) ?? { pending: 0, approved: 0, paid: 0, orders: 0 };
    if (r.status === "pending") e.pending += num(r.total);
    if (r.status === "approved") e.approved += num(r.total);
    if (r.status === "paid") e.paid += num(r.total);
    if (r.status !== "reversed" && r.status !== "rejected") e.orders += Number(r.cnt);
    earn.set(r.affiliateId, e);
  }
  const clickCount = new Map<string, number>();
  for (const r of clickRows) if (r.affiliateId) clickCount.set(r.affiliateId, Number(r.cnt));

  return { earn, clickCount };
}

function mapAffiliate(row: any, stats: any, clickCount: Map<string, number>): Affiliate {
  const e = stats.get(row.aff.id) ?? { pending: 0, approved: 0, paid: 0, orders: 0 };
  const clk = clickCount.get(row.aff.id) ?? 0;
  const total = e.approved + e.paid;
  const ordersN = e.orders;
  return {
    id: row.aff.id,
    name: row.user?.name ?? row.user?.email ?? "Unknown",
    email: row.user?.email ?? "",
    shopifyCustomerId: row.aff.shopifyCustomerId ?? null,
    refCode: row.aff.refCode,
    code: row.code?.code ?? row.aff.refCode,
    status: row.aff.status,
    paypalEmail: row.aff.paypalEmail,
    payoutMethod: row.aff.payoutMethod ?? "venmo",
    phone: row.aff.phone ?? null,
    phoneVerified: Boolean(row.aff.phoneVerifiedAt),
    address: row.aff.address ?? null,
    addressLine1: row.aff.addressLine1 ?? null,
    addressLine2: row.aff.addressLine2 ?? null,
    city: row.aff.city ?? null,
    region: row.aff.region ?? null,
    postalCode: row.aff.postalCode ?? null,
    country: row.aff.country ?? null,
    samplesBanned: !!row.aff.samplesBanned,
    companyName: row.aff.companyName,
    channel: row.aff.channel ?? null,
    audienceSize: row.aff.audienceSize ?? null,
    handle: row.aff.handle ?? null,
    bio: row.aff.bio ?? null,
    programId: row.aff.programId ?? "",
    programName: row.program?.name ?? "—",
    payoutMinimum: num(row.program?.payoutMinimum),
    notificationPrefs: (row.aff.notificationPrefs as Record<string, boolean>) ?? {},
    groupId: row.aff.groupId,
    groupName: row.group?.name ?? null,
    socialLinks: row.aff.socialLinks ?? {},
    clicks: clk,
    orders: ordersN,
    conversionRate: clk > 0 ? Math.round((ordersN / clk) * 1000) / 10 : 0,
    epc: clk > 0 ? Math.round((total / clk) * 100) / 100 : 0,
    pendingEarnings: e.pending,
    approvedEarnings: e.approved,
    paidEarnings: e.paid,
    totalEarned: total,
    joinedAt: (row.aff.createdAt ?? new Date()).toISOString?.() ?? String(row.aff.createdAt),
  };
}

async function loadAffiliates(where?: any): Promise<Affiliate[]> {
  if (!db) return [];
  const rows = await db
    .select({ aff: affiliates, user: users, program: programs, group: groups })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .leftJoin(programs, eq(affiliates.programId, programs.id))
    .leftJoin(groups, eq(affiliates.groupId, groups.id))
    .where(where)
    .orderBy(desc(affiliates.createdAt));

  // attach one discount code per affiliate
  const ids = rows.map((r) => r.aff.id);
  const codes = ids.length
    ? await db.select().from(discountCodes).where(inArray(discountCodes.affiliateId, ids))
    : [];
  const codeByAff = new Map(codes.map((c) => [c.affiliateId!, c]));

  const { earn, clickCount } = await affiliateStatMaps(ids);
  return rows
    .map((r) => mapAffiliate({ ...r, code: codeByAff.get(r.aff.id) }, earn, clickCount))
    .sort((a, b) => b.totalEarned - a.totalEarned);
}

export const listAffiliates = () => loadAffiliates();
export const getPendingApprovals = () => loadAffiliates(eq(affiliates.status, "pending"));
export const getTopAffiliates = async (n = 6) =>
  (await loadAffiliates(eq(affiliates.status, "approved"))).slice(0, n);

export async function getAffiliate(id: string): Promise<Affiliate | undefined> {
  const rows = await loadAffiliates(eq(affiliates.id, id));
  return rows[0];
}

export async function getAffiliateByUserId(userId: string): Promise<Affiliate | undefined> {
  if (!db) return undefined;
  const rows = await loadAffiliates(eq(affiliates.userId, userId));
  return rows[0];
}

// ---------- Programs / Groups ----------

export async function listPrograms(): Promise<Program[]> {
  if (!db) return [];
  const rows = await db.select().from(programs).orderBy(desc(programs.isDefault), programs.name);
  const counts = await db
    .select({ programId: affiliates.programId, cnt: sql<number>`count(*)` })
    .from(affiliates)
    .groupBy(affiliates.programId);
  const cmap = new Map(counts.map((c) => [c.programId, Number(c.cnt)]));
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    commissionType: p.commissionType,
    commissionValue: num(p.commissionValue),
    cookieWindowDays: p.cookieWindowDays,
    holdDays: p.holdDays,
    payoutMinimum: num(p.payoutMinimum),
    newCustomerOnly: Boolean(p.newCustomerOnly),
    isDefault: Boolean(p.isDefault),
    affiliateCount: cmap.get(p.id) ?? 0,
  }));
}

export async function getDefaultProgram(): Promise<Program | undefined> {
  return (await listPrograms()).find((p) => p.isDefault);
}

export async function getGroup(id: string): Promise<Group | undefined> {
  return (await listGroups()).find((g) => g.id === id);
}

// ---------- Campaigns ----------

function mapCampaign(c: any, count: number): Campaign {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    status: c.status,
    access: c.access ?? "approval",
    slug: c.slug ?? null,
    shortCode: c.shortCode ?? null,
    destinationUrl: c.destinationUrl ?? null,
    startsAt: c.startsAt ? new Date(c.startsAt).toISOString() : null,
    endsAt: c.endsAt ? new Date(c.endsAt).toISOString() : null,
    description: c.description ?? "",
    codePrefix: c.codePrefix ?? null,
    rewardType: c.rewardType ?? "percent",
    rewardValue: num(c.rewardValue),
    friendRewardType: c.friendRewardType ?? "percent",
    friendRewardValue: num(c.friendRewardValue),
    config: mergeConfig(c.config),
    memberCount: count,
  };
}

async function campaignCounts() {
  if (!db) return new Map<string, number>();
  const rows = await db
    .select({ campaignId: affiliateCampaigns.campaignId, cnt: sql<number>`count(*)` })
    .from(affiliateCampaigns)
    .groupBy(affiliateCampaigns.campaignId);
  return new Map(rows.map((r) => [r.campaignId, Number(r.cnt)]));
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (!db) return [];
  const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  const counts = await campaignCounts();
  return rows.map((c) => mapCampaign(c, counts.get(c.id) ?? 0));
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  if (!db) return undefined;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
  if (!c) return undefined;
  const counts = await campaignCounts();
  return mapCampaign(c, counts.get(id) ?? 0);
}

export async function getCampaignBySlug(slug: string): Promise<Campaign | undefined> {
  if (!db) return undefined;
  const c = await db.query.campaigns.findFirst({ where: eq(campaigns.slug, slug) });
  if (!c) return undefined;
  const counts = await campaignCounts();
  return mapCampaign(c, counts.get(c.id) ?? 0);
}

// ---------- App settings ----------

export const DEFAULT_DESTINATION_FALLBACK = "https://syruvia.com";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  if (!db) return fallback;
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value ?? fallback;
}

export async function getDefaultDestination(): Promise<string> {
  return getSetting("default_destination_url", DEFAULT_DESTINATION_FALLBACK);
}

export interface Banner {
  enabled: boolean;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string; // desktop / website image
  imageUrlMobile: string; // optional separate image for phones
}

/** A promo banner for a page ("samples" | "promotions"). Null when not set/off. */
export async function getBanner(placement: "samples" | "promotions"): Promise<Banner | null> {
  const raw = await getSetting(`banner_${placement}`, "");
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as Partial<Banner>;
    if (!b.enabled || (!b.title && !b.body && !b.imageUrl && !b.imageUrlMobile)) return null;
    return {
      enabled: true,
      title: b.title ?? "",
      body: b.body ?? "",
      ctaLabel: b.ctaLabel ?? "",
      ctaUrl: b.ctaUrl ?? "",
      imageUrl: b.imageUrl ?? "",
      imageUrlMobile: b.imageUrlMobile ?? "",
    };
  } catch {
    return null;
  }
}

export async function getBrand(): Promise<BrandSettings> {
  const raw = await getSetting("brand", "");
  try {
    return mergeBrand(raw ? JSON.parse(raw) : null);
  } catch {
    return mergeBrand(null);
  }
}

export interface EarningRate {
  valueType: "percent" | "flat";
  value: number;
  source: "campaign" | "program";
  sourceName: string;
  /** Pretty label, e.g. "15%" or "$5 per sale". */
  label: string;
  /** All active campaigns the affiliate is in (the applied one flagged). */
  campaigns: { name: string; label: string; applied: boolean }[];
}

const rateLabel = (t: "percent" | "flat", v: number) => (t === "percent" ? `${v}%` : `$${v} per sale`);

/**
 * The rate an affiliate actually earns — mirrors attribution: when they're in
 * one or more active campaigns, the most recently JOINED one applies (that's
 * exactly how attribution picks it); otherwise their program rate applies.
 */
export async function getEarningRate(affiliateId: string): Promise<EarningRate | null> {
  if (!db) return null;

  // All active campaigns they're in — newest join first (attribution's order).
  const campRows = await db
    .select({ camp: campaigns })
    .from(affiliateCampaigns)
    .innerJoin(campaigns, eq(affiliateCampaigns.campaignId, campaigns.id))
    .where(and(eq(affiliateCampaigns.affiliateId, affiliateId), eq(campaigns.status, "active")))
    .orderBy(desc(affiliateCampaigns.createdAt));

  if (campRows.length > 0) {
    const list = campRows.map(({ camp }) => {
      const cfg = mergeConfig(camp.config);
      const valueType = cfg.reward.valueType === "percent" ? "percent" : "flat";
      const value = Number(cfg.reward.value) || 0;
      return { name: camp.name, valueType: valueType as "percent" | "flat", value };
    });
    const applied = list[0]; // most recently joined wins
    return {
      valueType: applied.valueType,
      value: applied.value,
      source: "campaign",
      sourceName: applied.name,
      label: rateLabel(applied.valueType, applied.value),
      campaigns: list.map((c, i) => ({ name: c.name, label: rateLabel(c.valueType, c.value), applied: i === 0 })),
    };
  }

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  const program = aff?.programId
    ? await db.query.programs.findFirst({ where: eq(programs.id, aff.programId) })
    : await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
  if (!program) return null;
  const valueType = program.commissionType === "percent" ? "percent" : "flat";
  const value = Number(program.commissionValue) || 0;
  return { valueType, value, source: "program", sourceName: program.name, label: rateLabel(valueType, value), campaigns: [] };
}

/** Campaign IDs an affiliate belongs to. */
export async function getAffiliateCampaignIds(affiliateId: string): Promise<string[]> {
  if (!db) return [];
  const rows = await db
    .select({ campaignId: affiliateCampaigns.campaignId })
    .from(affiliateCampaigns)
    .where(eq(affiliateCampaigns.affiliateId, affiliateId));
  return rows.map((r) => r.campaignId);
}

/** Affiliate IDs that belong to a campaign. */
export async function getCampaignMemberIds(campaignId: string): Promise<string[]> {
  if (!db) return [];
  const rows = await db
    .select({ affiliateId: affiliateCampaigns.affiliateId })
    .from(affiliateCampaigns)
    .where(eq(affiliateCampaigns.campaignId, campaignId));
  return rows.map((r) => r.affiliateId);
}

export interface InviteTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
}

export async function listInviteTemplates(): Promise<InviteTemplate[]> {
  if (!db) return [];
  const rows = await db.select().from(inviteTemplates).orderBy(desc(inviteTemplates.isDefault), inviteTemplates.name);
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    isDefault: Boolean(t.isDefault),
  }));
}

export async function listGroups(): Promise<Group[]> {
  if (!db) return [];
  const rows = await db.select().from(groups).orderBy(groups.name);
  const counts = await db
    .select({ groupId: affiliates.groupId, cnt: sql<number>`count(*)` })
    .from(affiliates)
    .groupBy(affiliates.groupId);
  const cmap = new Map(counts.map((c) => [c.groupId, Number(c.cnt)]));
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description ?? "",
    memberCount: cmap.get(g.id) ?? 0,
  }));
}

// ---------- Commissions ----------

export async function listCommissions(filter?: CommissionState, affiliateId?: string, limit?: number): Promise<Commission[]> {
  if (!db) return [];
  // NOTE: do NOT join discount_codes here — an affiliate with 2+ codes would
  // fan each commission into N rows and double-count the ledger. Attach one
  // code per affiliate from a keyed map instead.
  const conds = [
    filter ? eq(commissions.status, filter) : undefined,
    affiliateId ? eq(commissions.affiliateId, affiliateId) : undefined,
  ].filter(Boolean) as any[];
  const base = db
    .select({ c: commissions, user: users, order: orders })
    .from(commissions)
    .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .leftJoin(orders, eq(commissions.orderId, orders.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(commissions.createdAt));
  const rows = await (limit ? base.limit(limit) : base);

  const affIds = [...new Set(rows.map((r) => r.c.affiliateId).filter(Boolean))] as string[];
  const codes = affIds.length
    ? await db.select().from(discountCodes).where(inArray(discountCodes.affiliateId, affIds))
    : [];
  const codeByAff = new Map<string, string>();
  for (const dc of codes) if (dc.affiliateId && !codeByAff.has(dc.affiliateId)) codeByAff.set(dc.affiliateId, dc.code);

  return rows.map((r) => ({
    id: r.c.id,
    orderNumber: r.order?.orderNumber ?? "—",
    affiliateId: r.c.affiliateId ?? "",
    affiliateName: r.user?.name ?? r.user?.email ?? "Unknown",
    affiliateCode: r.c.affiliateId ? codeByAff.get(r.c.affiliateId) ?? "" : "",
    amount: num(r.c.amount),
    currency: r.c.currency ?? "USD",
    attributedBy: (r.c.attributedBy as "coupon" | "link") ?? "coupon",
    status: r.c.status,
    orderTotal: num(r.order?.total),
    approvableAt: r.c.approvableAt ? new Date(r.c.approvableAt).toISOString() : null,
    flagged: !!r.c.flagged,
    flagReason: r.c.flagReason ?? null,
    createdAt: new Date(r.c.createdAt ?? Date.now()).toISOString(),
  }));
}

export async function getAffiliateCommissions(affiliateId: string, limit = 20): Promise<Commission[]> {
  // Bound in SQL — never load an affiliate's entire commission history.
  return listCommissions(undefined, affiliateId, limit);
}

// Convenience aliases used by pages.
export const getRevenueSeries = (days = 30) => getEarningsSeries(days);
export const getAffiliateEarnings = (days = 30, affiliateId?: string) => getEarningsSeries(days, affiliateId);
export const getAffiliateSummary = (a: Affiliate) => affiliateSummary(a);

// ---------- Orders ----------

export async function listOrders(): Promise<Order[]> {
  if (!db) return [];
  // Affiliate orders only — never the store's ordinary Shopify orders. An order
  // counts as an affiliate order if it earned a commission OR it used a discount
  // code that belongs to an affiliate (so self-referral / not-yet-approved orders
  // still surface, with their reason). The store's own promo/sample orders drop out.
  const rows = await db
    .select()
    .from(orders)
    .where(
      or(
        sql`exists (select 1 from ${commissions} where ${commissions.orderId} = ${orders.id})`,
        sql`exists (
          select 1
          from jsonb_array_elements_text(coalesce(${orders.discountCodesUsed}, '[]'::jsonb)) as dc(code)
          join discount_codes dcs on upper(dcs.code) = upper(dc.code)
          where dcs.affiliate_id is not null
        )`,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(50);

  // Attach the attributed affiliate name (positive commission) without join fan-out.
  const ids = rows.map((o) => o.id);
  const nameByOrder = new Map<string, string>();
  if (ids.length) {
    const attr = await db
      .select({ orderId: commissions.orderId, name: users.name, email: users.email })
      .from(commissions)
      .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
      .leftJoin(users, eq(affiliates.userId, users.id))
      .where(and(inArray(commissions.orderId, ids), sql`${commissions.amount} >= 0`));
    for (const a of attr) if (a.orderId) nameByOrder.set(a.orderId, a.name ?? a.email ?? "");
  }

  return rows.map((o) => ({
    id: o.id,
    shopifyOrderId: o.shopifyOrderId,
    orderNumber: o.orderNumber ?? "—",
    customerEmail: o.customerEmail ?? "",
    subtotal: num(o.subtotal),
    total: num(o.total),
    currency: o.currency ?? "USD",
    discountCodesUsed: o.discountCodesUsed ?? [],
    isNewCustomer: Boolean(o.isNewCustomer),
    financialStatus: o.financialStatus ?? "paid",
    affiliateName: nameByOrder.get(o.id) || null,
    attributionStatus: o.attributionStatus ?? null,
    createdAt: new Date(o.createdAt ?? Date.now()).toISOString(),
  }));
}

/**
 * Affiliate orders that used an affiliate code (or link) but produced NO
 * commission — self-referral blocked, affiliate not approved, campaign rules,
 * etc. Surfaced on the ledger so an admin can see why an affiliate sale didn't
 * pay out, instead of it vanishing silently.
 */
export async function listUnattributedAffiliateOrders(): Promise<Order[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(orders)
    .where(
      and(
        sql`not exists (select 1 from ${commissions} where ${commissions.orderId} = ${orders.id})`,
        sql`exists (
          select 1
          from jsonb_array_elements_text(coalesce(${orders.discountCodesUsed}, '[]'::jsonb)) as dc(code)
          join discount_codes dcs on upper(dcs.code) = upper(dc.code)
          where dcs.affiliate_id is not null
        )`,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(25);

  return rows.map((o) => ({
    id: o.id,
    shopifyOrderId: o.shopifyOrderId,
    orderNumber: o.orderNumber ?? "—",
    customerEmail: o.customerEmail ?? "",
    subtotal: num(o.subtotal),
    total: num(o.total),
    currency: o.currency ?? "USD",
    discountCodesUsed: o.discountCodesUsed ?? [],
    isNewCustomer: Boolean(o.isNewCustomer),
    financialStatus: o.financialStatus ?? "paid",
    affiliateName: null,
    attributionStatus: o.attributionStatus ?? null,
    createdAt: new Date(o.createdAt ?? Date.now()).toISOString(),
  }));
}

/**
 * Every affiliate order with the affiliate resolved — from a real commission if
 * one exists, otherwise from the affiliate discount code the order used. So even
 * a self-referral-blocked or not-yet-approved order shows WHO the affiliate is,
 * the reason it didn't pay, and (when attributed) the commission.
 */
export async function listAffiliateOrders(limit = 100): Promise<AffiliateOrder[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(orders)
    .where(
      or(
        sql`exists (select 1 from ${commissions} where ${commissions.orderId} = ${orders.id})`,
        sql`exists (
          select 1
          from jsonb_array_elements_text(coalesce(${orders.discountCodesUsed}, '[]'::jsonb)) as dc(code)
          join discount_codes dcs on upper(dcs.code) = upper(dc.code)
          where dcs.affiliate_id is not null
        )`,
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit);
  const ids = rows.map((o) => o.id);

  // Map every affiliate discount code → its affiliate (name + code).
  const codeRows = await db
    .select({ code: discountCodes.code, affId: discountCodes.affiliateId, name: users.name, email: users.email })
    .from(discountCodes)
    .leftJoin(affiliates, eq(discountCodes.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(isNotNull(discountCodes.affiliateId));
  const codeMap = new Map<string, { affiliateId: string; name: string; code: string }>();
  const affById = new Map<string, { name: string; code: string }>();
  for (const c of codeRows) {
    if (!c.affId) continue;
    const name = c.name ?? c.email ?? "Unknown";
    codeMap.set(c.code.toUpperCase(), { affiliateId: c.affId, name, code: c.code });
    if (!affById.has(c.affId)) affById.set(c.affId, { name, code: c.code });
  }

  // Commissions (positive) tied to these orders — the source of a paid attribution.
  const commMap = new Map<string, { affiliateId: string | null; name: string; amount: number; status: string }>();
  if (ids.length) {
    const commRows = await db
      .select({
        orderId: commissions.orderId,
        affiliateId: commissions.affiliateId,
        amount: commissions.amount,
        status: commissions.status,
        name: users.name,
        email: users.email,
      })
      .from(commissions)
      .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
      .leftJoin(users, eq(affiliates.userId, users.id))
      .where(and(inArray(commissions.orderId, ids), sql`${commissions.amount} >= 0`));
    for (const c of commRows) {
      if (c.orderId && !commMap.has(c.orderId)) {
        commMap.set(c.orderId, {
          affiliateId: c.affiliateId,
          name: c.name ?? c.email ?? "Unknown",
          amount: num(c.amount),
          status: c.status,
        });
      }
    }
  }

  return rows.map((o) => {
    const comm = commMap.get(o.id);
    let affiliateId: string | null = null;
    let affiliateName: string | null = null;
    let affiliateCode: string | null = null;

    if (comm) {
      affiliateId = comm.affiliateId;
      affiliateName = comm.name;
      affiliateCode = (comm.affiliateId && affById.get(comm.affiliateId)?.code) || null;
    } else {
      // No commission — resolve the affiliate from the code the order used.
      for (const code of (o.discountCodesUsed ?? []).map((c) => c.toUpperCase())) {
        const m = codeMap.get(code);
        if (m) {
          affiliateId = m.affiliateId;
          affiliateName = m.name;
          affiliateCode = m.code;
          break;
        }
      }
    }

    return {
      id: o.id,
      shopifyOrderId: o.shopifyOrderId,
      orderNumber: o.orderNumber ?? "—",
      customerEmail: o.customerEmail ?? "",
      total: num(o.total),
      currency: o.currency ?? "USD",
      financialStatus: o.financialStatus ?? "paid",
      affiliateId,
      affiliateName,
      affiliateCode,
      attributionStatus: o.attributionStatus ?? null,
      commissionAmount: comm ? comm.amount : null,
      commissionStatus: comm ? comm.status : null,
      createdAt: new Date(o.createdAt ?? Date.now()).toISOString(),
    };
  });
}

// ---------- Payouts ----------

export async function listPayouts(): Promise<Payout[]> {
  if (!db) return [];
  const rows = await db.select().from(payouts).orderBy(desc(payouts.createdAt));
  const items = rows.length
    ? await db
        .select({ it: payoutItems, user: users })
        .from(payoutItems)
        .leftJoin(affiliates, eq(payoutItems.affiliateId, affiliates.id))
        .leftJoin(users, eq(affiliates.userId, users.id))
    : [];
  return rows.map((p) => ({
    id: p.id,
    senderBatchId: p.senderBatchId,
    paypalBatchId: p.paypalBatchId,
    status: p.status,
    totalAmount: num(p.totalAmount),
    affiliateCount: p.affiliateCount ?? 0,
    createdAt: new Date(p.createdAt ?? Date.now()).toISOString(),
    items: items
      .filter((i) => i.it.payoutId === p.id)
      .map((i) => ({
        id: i.it.id,
        affiliateId: i.it.affiliateId ?? null,
        affiliateName: i.user?.name ?? "Unknown",
        affiliateEmail: i.user?.email ?? "",
        amount: num(i.it.amount),
        currency: i.it.currency ?? "USD",
        transactionStatus: i.it.transactionStatus ?? "PENDING",
        paypalItemId: i.it.paypalItemId ?? null,
      })),
  }));
}

/** One payout batch with its line items (drill-down / export). */
export async function getPayout(id: string): Promise<Payout | null> {
  if (!db) return null;
  const p = await db.query.payouts.findFirst({ where: eq(payouts.id, id) });
  if (!p) return null;
  const items = await db
    .select({ it: payoutItems, user: users })
    .from(payoutItems)
    .leftJoin(affiliates, eq(payoutItems.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(payoutItems.payoutId, id));
  return {
    id: p.id,
    senderBatchId: p.senderBatchId,
    paypalBatchId: p.paypalBatchId,
    status: p.status,
    totalAmount: num(p.totalAmount),
    affiliateCount: p.affiliateCount ?? 0,
    createdAt: new Date(p.createdAt ?? Date.now()).toISOString(),
    items: items.map((i) => ({
      id: i.it.id,
      affiliateId: i.it.affiliateId ?? null,
      affiliateName: i.user?.name ?? "Unknown",
      affiliateEmail: i.user?.email ?? "",
      amount: num(i.it.amount),
      currency: i.it.currency ?? "USD",
      transactionStatus: i.it.transactionStatus ?? "PENDING",
      paypalItemId: i.it.paypalItemId ?? null,
    })),
  };
}

/** Actual money paid out = sum of successfully-completed payout items. */
export async function paidAllTime(): Promise<number> {
  if (!db) return 0;
  const [r] = await db
    .select({ total: sql<string>`coalesce(sum(${payoutItems.amount}),0)` })
    .from(payoutItems)
    .where(inArray(payoutItems.transactionStatus, [...PAID_ITEM_STATUSES]));
  return num(r?.total);
}

export interface PaidRecipient {
  affiliateId: string | null;
  name: string;
  email: string;
  total: number;
  payments: number;
}

/** Distinct affiliates who have actually been paid (successful items), all-time. */
export async function getPaidRecipients(): Promise<PaidRecipient[]> {
  if (!db) return [];
  const rows = await db
    .select({
      affiliateId: payoutItems.affiliateId,
      name: users.name,
      email: users.email,
      total: sql<string>`sum(${payoutItems.amount})`,
      payments: sql<number>`count(*)`,
    })
    .from(payoutItems)
    .leftJoin(affiliates, eq(payoutItems.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(inArray(payoutItems.transactionStatus, [...PAID_ITEM_STATUSES]))
    .groupBy(payoutItems.affiliateId, users.name, users.email);
  return rows
    .map((r) => ({
      affiliateId: r.affiliateId ?? null,
      name: r.name ?? r.email ?? "Unknown",
      email: r.email ?? "",
      total: num(r.total),
      payments: Number(r.payments),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface DiscountCodeRow {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  affiliateId: string | null;
  affiliateName: string | null;
  shopifyDiscountId: string | null;
  syncedToShopify: boolean;
  createdAt: string | null;
}

export async function listDiscountCodes(): Promise<DiscountCodeRow[]> {
  if (!db) return [];
  const rows = await db
    .select({ code: discountCodes, affName: users.name, affId: affiliates.id })
    .from(discountCodes)
    .leftJoin(affiliates, eq(discountCodes.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .orderBy(desc(discountCodes.createdAt));
  return rows.map((r) => ({
    id: r.code.id,
    code: r.code.code,
    percentage: Number(r.code.percentage ?? 0),
    active: r.code.active ?? true,
    affiliateId: r.affId ?? null,
    affiliateName: r.affName ?? null,
    shopifyDiscountId: r.code.shopifyDiscountId ?? null,
    syncedToShopify: !!r.code.shopifyDiscountId,
    createdAt: r.code.createdAt ? r.code.createdAt.toISOString() : null,
  }));
}

export async function getPayableBatch() {
  if (!db) return [];
  const affs = await loadAffiliates(eq(affiliates.status, "approved"));
  const progs = await listPrograms();
  const pmap = new Map(progs.map((p) => [p.id, p.payoutMinimum]));
  return affs
    .filter((a) => a.paypalEmail && a.approvedEarnings >= (pmap.get(a.programId) ?? 0) && a.approvedEarnings > 0)
    .map((a) => ({ affiliateId: a.id, name: a.name, paypalEmail: a.paypalEmail!, amount: a.approvedEarnings }));
}

// ---------- Messages / Promotions / Assets ----------

export async function listMessages(): Promise<Message[]> {
  if (!db) return [];
  const rows = await db.select().from(messages).orderBy(desc(messages.createdAt));
  return rows.map((m) => ({
    id: m.id,
    subject: m.subject ?? "",
    body: m.body ?? "",
    channel: (m.channel as "email" | "sms") ?? "email",
    audienceLabel: labelAudience(m.audience),
    recipients: m.recipientCount ?? 0,
    openRate: null,
    scheduledFor: m.scheduledFor ? new Date(m.scheduledFor).toISOString() : null,
    sentAt: m.sentAt ? new Date(m.sentAt).toISOString() : null,
  }));
}
function labelAudience(a: any): string {
  if (!a) return "All affiliates";
  if (a.status?.length) return a.status.join(", ");
  if (a.groupIds?.length) return `${a.groupIds.length} group(s)`;
  return "All affiliates";
}

export interface InboxMessage {
  id: string;
  subject: string;
  body: string;
  sentAt: string | null;
  scope: "group" | "everyone";
}

/**
 * Messages an affiliate should see in their portal: broadcasts to everyone,
 * to their status, or to a group they belong to. Personalization variables
 * are rendered against the affiliate.
 */
export async function getMessagesForAffiliate(aff: Affiliate): Promise<InboxMessage[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(messages)
    .where(isNotNull(messages.sentAt))
    .orderBy(desc(messages.sentAt));

  const personalize = (text: string) =>
    (text ?? "")
      .replaceAll("{{name}}", aff.name)
      .replaceAll("{{code}}", aff.code ?? aff.refCode)
      .replaceAll("{{earnings}}", `$${(aff.totalEarned ?? 0).toFixed(2)}`)
      .replaceAll("{{link}}", `${aff.refCode}`);

  const out: InboxMessage[] = [];
  for (const m of rows) {
    const a = (m.audience ?? {}) as { groupIds?: string[]; status?: string[] };
    const inGroup = !!(aff.groupId && a.groupIds?.includes(aff.groupId));
    const inStatus = !!a.status?.includes(aff.status);
    const everyone = !a.groupIds?.length && !a.status?.length;
    if (!inGroup && !inStatus && !everyone) continue;
    out.push({
      id: m.id,
      subject: personalize(m.subject ?? ""),
      body: personalize(m.body ?? ""),
      sentAt: m.sentAt ? new Date(m.sentAt).toISOString() : null,
      scope: inGroup ? "group" : "everyone",
    });
  }
  return out;
}

/** Live & upcoming promotions relevant to an affiliate (their group or all). */
export async function getPromotionsForAffiliate(aff: Affiliate): Promise<Promotion[]> {
  if (!db) return [];
  const rows = await db.select().from(promotions).orderBy(desc(promotions.startsAt));
  const groupMap = new Map((await db.select().from(groups)).map((g) => [g.id, g.name]));
  const now = Date.now();
  return rows
    .filter((p) => !p.groupId || p.groupId === aff.groupId)
    .map((p) => {
      const start = p.startsAt ? new Date(p.startsAt).getTime() : now;
      const end = p.endsAt ? new Date(p.endsAt).getTime() : now;
      const status = now < start ? "scheduled" : now > end ? "ended" : "live";
      return {
        id: p.id,
        name: p.name,
        bonusType: (p.bonusType as "percent" | "flat") ?? "percent",
        bonusValue: num(p.bonusValue),
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        groupName: p.groupId ? groupMap.get(p.groupId) ?? "Your group" : "All affiliates",
        status: status as Promotion["status"],
        product: promoProduct(p),
      };
    })
    .filter((p) => p.status !== "ended");
}

export async function listPromotions(): Promise<Promotion[]> {
  if (!db) return [];
  const rows = await db.select().from(promotions).orderBy(desc(promotions.startsAt));
  const now = Date.now();
  return rows.map((p) => {
    const start = p.startsAt ? new Date(p.startsAt).getTime() : now;
    const end = p.endsAt ? new Date(p.endsAt).getTime() : now;
    const status = now < start ? "scheduled" : now > end ? "ended" : "live";
    return {
      id: p.id,
      name: p.name,
      bonusType: (p.bonusType as "percent" | "flat") ?? "percent",
      bonusValue: num(p.bonusValue),
      startsAt: new Date(start).toISOString(),
      endsAt: new Date(end).toISOString(),
      groupName: "All affiliates",
      status: status as Promotion["status"],
      product: promoProduct(p),
    };
  });
}

function promoProduct(p: {
  productId: string | null;
  productTitle: string | null;
  productImage: string | null;
  productUrl: string | null;
}): Promotion["product"] {
  if (!p.productId || !p.productUrl) return null;
  return { id: p.productId, title: p.productTitle ?? "Featured product", image: p.productImage, url: p.productUrl };
}

export async function listAssets(): Promise<Asset[]> {
  if (!db) return [];
  const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
  const grads = [
    "linear-gradient(135deg,#0f3d2e,#134e37)",
    "linear-gradient(135deg,#3a2f14,#6b5326)",
    "linear-gradient(135deg,#1b2a4a,#2a3f6b)",
  ];
  return rows.map((a, i) => ({
    id: a.id,
    title: a.title,
    kind: (a.kind as Asset["kind"]) ?? "banner",
    dimensions: a.dimensions ?? "",
    gradient: grads[i % grads.length],
    url: a.url ?? null,
  }));
}

// ---------- Time series ----------

export async function getEarningsSeries(days = 30, affiliateId?: string): Promise<TimePoint[]> {
  if (!db) return [];
  const since = new Date(Date.now() - days * DAY);
  // Exclude reversed/rejected commissions and negative adjustment rows — a
  // cancelled or refunded order is not affiliate-driven revenue.
  const live = sql`${commissions.status} not in ('reversed','rejected') and ${commissions.amount} >= 0`;
  const where = affiliateId
    ? and(gte(commissions.createdAt, since), eq(commissions.affiliateId, affiliateId), live)
    : and(gte(commissions.createdAt, since), live);
  const rows = await db
    .select({
      day: sql<string>`date_trunc('day', ${commissions.createdAt})`,
      earnings: sql<string>`sum(${commissions.amount})`,
      cnt: sql<number>`count(*)`,
    })
    .from(commissions)
    .where(where)
    .groupBy(sql`date_trunc('day', ${commissions.createdAt})`)
    .orderBy(sql`date_trunc('day', ${commissions.createdAt})`);

  const byDay = new Map(rows.map((r) => [new Date(r.day).toDateString(), r]));
  const out: TimePoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const r = byDay.get(d.toDateString());
    out.push({
      date: d.toISOString(),
      earnings: r ? num(r.earnings) : 0,
      orders: r ? Number(r.cnt) : 0,
      clicks: 0,
    });
  }
  return out;
}

// ---------- Admin KPIs ----------

export async function getAdminKpis(): Promise<AdminKpis> {
  if (!db) {
    return {
      affiliateRevenue: 0, affiliateRevenueDelta: 0, activeAffiliates: 0, activeAffiliatesDelta: 0,
      pendingCommissions: 0, pendingCommissionsCount: 0, refundRate: 0, refundRateDelta: 0,
      payableNow: 0, awaitingApproval: 0,
    };
  }
  const since = new Date(Date.now() - 30 * DAY);
  const prevSince = new Date(Date.now() - 60 * DAY);
  const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0);

  // Revenue from orders that earned a LIVE commission (not reversed/cancelled).
  // EXISTS (not a join) so each order's subtotal is counted once, and a reversed
  // commission drops the order out entirely.
  const liveCommission = sql`exists (
    select 1 from ${commissions}
    where ${commissions.orderId} = ${orders.id}
      and ${commissions.status} not in ('reversed','rejected')
      and ${commissions.amount} >= 0
  )`;
  const [rev] = await db
    .select({ total: sql<string>`coalesce(sum(${orders.subtotal}),0)` })
    .from(orders)
    .where(and(gte(orders.createdAt, since), liveCommission));
  // Prior 30-day window (30–60 days ago), to compute a real trend.
  const [revPrev] = await db
    .select({ total: sql<string>`coalesce(sum(${orders.subtotal}),0)` })
    .from(orders)
    .where(and(gte(orders.createdAt, prevSince), lt(orders.createdAt, since), liveCommission));

  const [active] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(affiliates)
    .where(eq(affiliates.status, "approved"));
  // Approved affiliates that existed 30 days ago, to show growth.
  const [activePrior] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(affiliates)
    .where(and(eq(affiliates.status, "approved"), lt(affiliates.createdAt, since)));

  const [pend] = await db
    .select({ total: sql<string>`coalesce(sum(${commissions.amount}),0)`, cnt: sql<number>`count(*)` })
    .from(commissions)
    .where(eq(commissions.status, "pending"));

  const [awaiting] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(affiliates)
    .where(eq(affiliates.status, "pending"));

  const [ordCount] = await db.select({ cnt: sql<number>`count(*)` }).from(orders);
  const [refCount] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.financialStatus, "refunded"));
  const refundRate = Number(ordCount?.cnt ?? 0) > 0 ? (Number(refCount?.cnt) / Number(ordCount.cnt)) * 100 : 0;

  // Windowed refund rate so the trend reflects the last 30 days vs the prior 30.
  const windowRate = async (start: Date, end?: Date) => {
    const cond = end ? and(gte(orders.createdAt, start), lt(orders.createdAt, end)) : gte(orders.createdAt, start);
    const [o] = await db.select({ cnt: sql<number>`count(*)` }).from(orders).where(cond);
    const [r] = await db.select({ cnt: sql<number>`count(*)` }).from(orders).where(and(cond, eq(orders.financialStatus, "refunded")));
    const oc = Number(o?.cnt ?? 0);
    return oc > 0 ? (Number(r?.cnt ?? 0) / oc) * 100 : 0;
  };
  const refundRateDelta = Math.round(((await windowRate(since)) - (await windowRate(prevSince, since))) * 10) / 10;

  const payable = await getPayableBatch();

  return {
    affiliateRevenue: num(rev?.total),
    affiliateRevenueDelta: pct(num(rev?.total), num(revPrev?.total)),
    activeAffiliates: Number(active?.cnt ?? 0),
    activeAffiliatesDelta: pct(Number(active?.cnt ?? 0), Number(activePrior?.cnt ?? 0)),
    pendingCommissions: num(pend?.total),
    pendingCommissionsCount: Number(pend?.cnt ?? 0),
    refundRate: Math.round(refundRate * 10) / 10,
    refundRateDelta,
    payableNow: payable.reduce((s, p) => s + p.amount, 0),
    awaitingApproval: Number(awaiting?.cnt ?? 0),
  };
}

// ---------- Affiliate portal summary ----------

export function affiliateSummary(a: Affiliate) {
  return {
    pending: a.pendingEarnings,
    approved: a.approvedEarnings,
    paidLifetime: a.paidEarnings,
    thisMonth: a.approvedEarnings + a.pendingEarnings,
    nextPayoutDate: null as string | null,
    payoutMinimum: a.payoutMinimum,
  };
}

// ---------- Sample requests ----------

function mapSample(r: any, user: any): SampleRequest {
  return {
    id: r.id,
    affiliateId: r.affiliateId,
    affiliateName: user?.name ?? user?.email ?? "Unknown",
    affiliateEmail: user?.email ?? "",
    productId: r.productId ?? null,
    productTitle: r.productTitle ?? "Sample",
    productImage: r.productImage ?? null,
    productUrl: r.productUrl ?? null,
    note: r.note ?? null,
    address: r.addressSnapshot ?? null,
    status: r.status,
    shopifyOrderId: r.shopifyOrderId ?? null,
    carrier: r.carrier ?? null,
    trackingNumber: r.trackingNumber ?? null,
    trackingUrl: r.trackingUrl ?? null,
    shippedAt: r.shippedAt ? new Date(r.shippedAt).toISOString() : null,
    createdAt: (r.createdAt ?? new Date()).toISOString?.() ?? String(r.createdAt),
    decidedAt: r.decidedAt ? new Date(r.decidedAt).toISOString() : null,
  };
}

export async function listSampleRequests(): Promise<SampleRequest[]> {
  if (!db) return [];
  const rows = await db
    .select({ s: sampleRequests, user: users })
    .from(sampleRequests)
    .leftJoin(affiliates, eq(sampleRequests.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .orderBy(desc(sampleRequests.createdAt));
  return rows.map((r) => mapSample(r.s, r.user));
}

export async function getMySampleRequests(affiliateId: string): Promise<SampleRequest[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(sampleRequests)
    .where(eq(sampleRequests.affiliateId, affiliateId))
    .orderBy(desc(sampleRequests.createdAt));
  return rows.map((r) => mapSample(r, null));
}

export async function pendingSampleCount(): Promise<number> {
  if (!db) return 0;
  const [r] = await db.select({ c: sql<number>`count(*)` }).from(sampleRequests).where(eq(sampleRequests.status, "requested"));
  return Number(r?.c ?? 0);
}

/** Red-dot counts for the admin sidebar (pending things that need attention). */
export async function getAdminNavBadges(): Promise<Record<string, number>> {
  if (!db) return {};
  const [samples, apps, dms] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(sampleRequests).where(eq(sampleRequests.status, "requested")),
    db.select({ c: sql<number>`count(*)` }).from(affiliates).where(eq(affiliates.status, "pending")),
    // Unread direct messages from affiliates (not from admin, not yet read).
    db.select({ c: sql<number>`count(*)` }).from(directMessages).where(and(eq(directMessages.fromAdmin, false), isNull(directMessages.readByAdminAt))),
  ]);
  const badges: Record<string, number> = {};
  const s = Number(samples[0]?.c ?? 0);
  const a = Number(apps[0]?.c ?? 0);
  const d = Number(dms[0]?.c ?? 0);
  if (s > 0) badges["/admin/samples"] = s;
  if (a > 0) badges["/admin/affiliates"] = a;
  if (d > 0) badges["/admin/messages"] = d;
  return badges;
}

// ---------- Group chat ----------

function pollTally(poll: any, votes: { optionIndex: number }[]) {
  if (!poll?.options) return null;
  const counts = new Array(poll.options.length).fill(0);
  for (const v of votes) if (v.optionIndex >= 0 && v.optionIndex < counts.length) counts[v.optionIndex]++;
  return {
    question: poll.question ?? "",
    options: poll.options.map((text: string, i: number) => ({ text, votes: counts[i] })),
    totalVotes: votes.length,
  };
}

/** Admin view of a group's chat: messages + read receipts + poll tallies. */
export async function getGroupChat(groupId: string): Promise<GroupChatMessage[]> {
  if (!db) return [];
  const msgs = await db.select().from(groupMessages).where(eq(groupMessages.groupId, groupId)).orderBy(desc(groupMessages.createdAt));
  if (!msgs.length) return [];
  const ids = msgs.map((m) => m.id);
  const reads = await db
    .select({ messageId: groupMessageReads.messageId, name: users.name, email: users.email })
    .from(groupMessageReads)
    .leftJoin(affiliates, eq(groupMessageReads.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(inArray(groupMessageReads.messageId, ids));
  const votes = await db.select().from(pollVotes).where(inArray(pollVotes.messageId, ids));
  const readsByMsg = new Map<string, string[]>();
  for (const r of reads) {
    const arr = readsByMsg.get(r.messageId) ?? [];
    arr.push(r.name ?? r.email ?? "Someone");
    readsByMsg.set(r.messageId, arr);
  }
  return msgs.map((m) => {
    const readers = readsByMsg.get(m.id) ?? [];
    return {
      id: m.id,
      body: m.body ?? null,
      attachments: (m.attachments as any) ?? [],
      poll: pollTally(m.poll, votes.filter((v) => v.messageId === m.id)),
      myVote: null,
      createdAt: new Date(m.createdAt ?? Date.now()).toISOString(),
      readCount: readers.length,
      readers,
    };
  });
}

/** Affiliate view: their group's messages + their own poll vote. No member identities. */
export async function getMyGroupChat(groupId: string, affiliateId: string): Promise<GroupChatMessage[]> {
  if (!db) return [];
  const msgs = await db.select().from(groupMessages).where(eq(groupMessages.groupId, groupId)).orderBy(desc(groupMessages.createdAt));
  if (!msgs.length) return [];
  const ids = msgs.map((m) => m.id);
  const votes = await db.select().from(pollVotes).where(inArray(pollVotes.messageId, ids));
  const myVotes = new Map(votes.filter((v) => v.affiliateId === affiliateId).map((v) => [v.messageId, v.optionIndex]));
  return msgs.map((m) => ({
    id: m.id,
    body: m.body ?? null,
    attachments: (m.attachments as any) ?? [],
    poll: pollTally(m.poll, votes.filter((v) => v.messageId === m.id)),
    myVote: myVotes.has(m.id) ? myVotes.get(m.id)! : null,
    createdAt: new Date(m.createdAt ?? Date.now()).toISOString(),
    readCount: 0,
    readers: [],
  }));
}

/** How many messages in this group the affiliate hasn't opened yet (badge). */
export async function unreadGroupCount(groupId: string, affiliateId: string): Promise<number> {
  if (!db) return 0;
  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(groupMessages).where(eq(groupMessages.groupId, groupId));
  const [{ read }] = await db
    .select({ read: sql<number>`count(*)` })
    .from(groupMessageReads)
    .innerJoin(groupMessages, eq(groupMessageReads.messageId, groupMessages.id))
    .where(and(eq(groupMessages.groupId, groupId), eq(groupMessageReads.affiliateId, affiliateId)));
  return Math.max(0, Number(total) - Number(read));
}
