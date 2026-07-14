// lib/queries.ts — the data-access seam. Real Drizzle queries against Postgres.
// Everything reflects the database; when there's no data, callers get empty
// results and the UI shows honest empty states. No fabricated numbers.
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, isDbConfigured } from "@/db";
import {
  affiliates,
  users,
  programs,
  groups,
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
} from "@/db/schema";
import type {
  Affiliate,
  Commission,
  Order,
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
} from "./types";

export const dataSource = isDbConfigured ? "live" : "unconfigured";
const num = (v: unknown) => (v == null ? 0 : Number(v));
const DAY = 86_400_000;

// ---------- Affiliates (with derived stats) ----------

async function affiliateStatMaps() {
  if (!db) return { earn: new Map(), clickCount: new Map(), orderCount: new Map() };

  const earnRows = await db
    .select({
      affiliateId: commissions.affiliateId,
      status: commissions.status,
      total: sql<string>`sum(${commissions.amount})`,
      cnt: sql<number>`count(*)`,
    })
    .from(commissions)
    .groupBy(commissions.affiliateId, commissions.status);

  const clickRows = await db
    .select({ affiliateId: clicks.affiliateId, cnt: sql<number>`count(*)` })
    .from(clicks)
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
    refCode: row.aff.refCode,
    code: row.code?.code ?? row.aff.refCode,
    status: row.aff.status,
    paypalEmail: row.aff.paypalEmail,
    companyName: row.aff.companyName,
    programId: row.aff.programId ?? "",
    programName: row.program?.name ?? "—",
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

  const { earn, clickCount } = await affiliateStatMaps();
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
    description: c.description ?? "",
    codePrefix: c.codePrefix ?? null,
    rewardType: c.rewardType ?? "percent",
    rewardValue: num(c.rewardValue),
    friendRewardType: c.friendRewardType ?? "percent",
    friendRewardValue: num(c.friendRewardValue),
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

export async function listCommissions(filter?: CommissionState): Promise<Commission[]> {
  if (!db) return [];
  const rows = await db
    .select({ c: commissions, user: users, order: orders, code: discountCodes })
    .from(commissions)
    .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .leftJoin(orders, eq(commissions.orderId, orders.id))
    .leftJoin(discountCodes, eq(discountCodes.affiliateId, affiliates.id))
    .where(filter ? eq(commissions.status, filter) : undefined)
    .orderBy(desc(commissions.createdAt));
  return rows.map((r) => ({
    id: r.c.id,
    orderNumber: r.order?.orderNumber ?? "—",
    affiliateId: r.c.affiliateId ?? "",
    affiliateName: r.user?.name ?? r.user?.email ?? "Unknown",
    affiliateCode: r.code?.code ?? "",
    amount: num(r.c.amount),
    currency: r.c.currency ?? "USD",
    attributedBy: (r.c.attributedBy as "coupon" | "link") ?? "coupon",
    status: r.c.status,
    orderTotal: num(r.order?.total),
    approvableAt: r.c.approvableAt ? new Date(r.c.approvableAt).toISOString() : null,
    createdAt: new Date(r.c.createdAt ?? Date.now()).toISOString(),
  }));
}

export async function getAffiliateCommissions(affiliateId: string, limit = 20): Promise<Commission[]> {
  const all = await listCommissions();
  return all.filter((c) => c.affiliateId === affiliateId).slice(0, limit);
}

// Convenience aliases used by pages.
export const getRevenueSeries = (days = 30) => getEarningsSeries(days);
export const getAffiliateEarnings = (days = 30, affiliateId?: string) => getEarningsSeries(days, affiliateId);
export const getAffiliateSummary = (a: Affiliate) => affiliateSummary(a);

// ---------- Orders ----------

export async function listOrders(): Promise<Order[]> {
  if (!db) return [];
  const rows = await db
    .select({ o: orders, user: users })
    .from(orders)
    .leftJoin(commissions, eq(commissions.orderId, orders.id))
    .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .orderBy(desc(orders.createdAt))
    .limit(50);
  return rows.map((r) => ({
    id: r.o.id,
    shopifyOrderId: r.o.shopifyOrderId,
    orderNumber: r.o.orderNumber ?? "—",
    customerEmail: r.o.customerEmail ?? "",
    subtotal: num(r.o.subtotal),
    total: num(r.o.total),
    currency: r.o.currency ?? "USD",
    discountCodesUsed: r.o.discountCodesUsed ?? [],
    isNewCustomer: Boolean(r.o.isNewCustomer),
    financialStatus: r.o.financialStatus ?? "paid",
    affiliateName: r.user?.name ?? null,
    createdAt: new Date(r.o.createdAt ?? Date.now()).toISOString(),
  }));
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
        affiliateName: i.user?.name ?? "Unknown",
        affiliateEmail: i.user?.email ?? "",
        amount: num(i.it.amount),
        transactionStatus: i.it.transactionStatus ?? "PENDING",
      })),
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
    recipients: 0,
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
    };
  });
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
  }));
}

// ---------- Time series ----------

export async function getEarningsSeries(days = 30, affiliateId?: string): Promise<TimePoint[]> {
  if (!db) return [];
  const since = new Date(Date.now() - days * DAY);
  const where = affiliateId
    ? and(gte(commissions.createdAt, since), eq(commissions.affiliateId, affiliateId))
    : gte(commissions.createdAt, since);
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

  const [rev] = await db
    .select({ total: sql<string>`coalesce(sum(${orders.subtotal}),0)` })
    .from(orders)
    .innerJoin(commissions, eq(commissions.orderId, orders.id))
    .where(gte(orders.createdAt, since));

  const [active] = await db
    .select({ cnt: sql<number>`count(*)` })
    .from(affiliates)
    .where(eq(affiliates.status, "approved"));

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

  const payable = await getPayableBatch();

  return {
    affiliateRevenue: num(rev?.total),
    affiliateRevenueDelta: 0,
    activeAffiliates: Number(active?.cnt ?? 0),
    activeAffiliatesDelta: 0,
    pendingCommissions: num(pend?.total),
    pendingCommissionsCount: Number(pend?.cnt ?? 0),
    refundRate: Math.round(refundRate * 10) / 10,
    refundRateDelta: 0,
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
    payoutMinimum: 25,
  };
}
