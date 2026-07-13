// Rich, deterministic demo dataset. Powers the UI whenever a live database
// isn't configured — and doubles as the shape the real queries return.
import type {
  Affiliate,
  AdminKpis,
  Asset,
  Commission,
  Group,
  Message,
  Order,
  Payout,
  Program,
  Promotion,
  TimePoint,
} from "./types";

// Deterministic PRNG so the numbers never change between renders.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260713);
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const round2 = (n: number) => Math.round(n * 100) / 100;

// A fixed reference "now" keeps the demo stable and free of Date.now().
const NOW = new Date("2026-07-13T12:00:00Z").getTime();
const DAY = 86_400_000;
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();

export const programs: Program[] = [
  {
    id: "prog-core",
    name: "Core Partner",
    commissionType: "percent",
    commissionValue: 15,
    cookieWindowDays: 30,
    holdDays: 30,
    payoutMinimum: 25,
    newCustomerOnly: false,
    isDefault: true,
    affiliateCount: 42,
  },
  {
    id: "prog-elite",
    name: "Elite Circle",
    commissionType: "percent",
    commissionValue: 25,
    cookieWindowDays: 60,
    holdDays: 21,
    payoutMinimum: 50,
    newCustomerOnly: false,
    isDefault: false,
    affiliateCount: 11,
  },
  {
    id: "prog-creator",
    name: "Creator Flat",
    commissionType: "flat",
    commissionValue: 20,
    cookieWindowDays: 30,
    holdDays: 30,
    payoutMinimum: 25,
    newCustomerOnly: true,
    isDefault: false,
    affiliateCount: 18,
  },
];

export const groups: Group[] = [
  { id: "grp-vip", name: "VIP Creators", description: "Top 5% by revenue — priority payouts & bonuses.", memberCount: 8 },
  { id: "grp-newsletter", name: "Newsletter Partners", description: "Email-first affiliates with owned audiences.", memberCount: 21 },
  { id: "grp-social", name: "Social & Video", description: "Instagram, TikTok and YouTube creators.", memberCount: 27 },
  { id: "grp-ambassador", name: "Brand Ambassadors", description: "Long-term contracted brand advocates.", memberCount: 6 },
];

const FIRST = ["Sarah", "Marcus", "Elena", "Julian", "Priya", "Theo", "Amara", "Nikolai", "Isabella", "Ravi", "Camille", "Dominic", "Sofia", "Aiden", "Lena", "Mateo", "Grace", "Anton", "Noor", "Felix", "Chloe", "Idris", "Vivienne", "Omar"];
const LAST = ["Whitfield", "Chen", "Rossi", "Okafor", "Nair", "Lindqvist", "Bennett", "Volkov", "Moreau", "Kapoor", "Laurent", "Ashford", "Marín", "Sinclair", "Berg", "Silva", "Hollis", "Petrov", "Rahman", "Adler", "Fontaine", "Malik", "Beaumont", "Haddad"];
const COMPANIES = ["Atelier Nord", "The Edit", "Wilder & Co", "Maison Reve", "Kindred Studio", "North Loop", "Verve Media", "Golden Hour", "Still Life", "Prism House", null, null, "Field Notes", "Lumen", null];

const socialSets: Record<string, string>[] = [
  { instagram: "@style.edit", tiktok: "@styleedit", youtube: "StyleEdit" },
  { instagram: "@thewilder", website: "wilder.co" },
  { newsletter: "The Sunday Drop", instagram: "@sundaydrop" },
  { youtube: "NorthLoopReviews", tiktok: "@northloop" },
  { website: "prismhouse.com", instagram: "@prism.house" },
];

const STATUSES: Affiliate["status"][] = [
  "approved", "approved", "approved", "approved", "approved", "approved",
  "approved", "approved", "pending", "pending", "suspended", "rejected",
];

function makeAffiliates(): Affiliate[] {
  const list: Affiliate[] = [];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[i % LAST.length];
    const name = `${first} ${last}`;
    const refCode = first.toUpperCase();
    const program = i < 4 ? programs[1] : i < 9 ? programs[2] : programs[0];
    const status = i < 2 ? "approved" : STATUSES[i % STATUSES.length];
    const isActive = status === "approved";
    const clicks = isActive ? Math.floor(between(180, 5200)) : Math.floor(between(0, 60));
    const conv = between(1.4, 6.8);
    const orders = Math.max(0, Math.floor((clicks * conv) / 100));
    const paid = isActive ? round2(between(120, 9800)) : 0;
    const approved = isActive ? round2(between(40, 2400)) : 0;
    const pending = isActive ? round2(between(20, 1600)) : round2(between(0, 90));
    const total = round2(paid + approved);
    const epc = clicks > 0 ? round2(total / clicks) : 0;
    const grp = isActive ? (i % 3 === 0 ? groups[0] : i % 3 === 1 ? groups[2] : groups[1]) : null;
    list.push({
      id: `aff-${i + 1}`,
      name,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@gmail.com`,
      refCode,
      code: `${refCode}${program.commissionType === "percent" ? program.commissionValue : 15}`,
      status,
      paypalEmail: isActive && rand() > 0.15 ? `${first.toLowerCase()}@paypal.com` : null,
      companyName: COMPANIES[i % COMPANIES.length],
      programId: program.id,
      programName: program.name,
      groupId: grp?.id ?? null,
      groupName: grp?.name ?? null,
      socialLinks: socialSets[i % socialSets.length],
      clicks,
      orders,
      conversionRate: round2(conv),
      epc,
      pendingEarnings: pending,
      approvedEarnings: approved,
      paidEarnings: paid,
      totalEarned: total,
      joinedAt: daysAgo(Math.floor(between(3, 420))),
    });
  }
  return list.sort((a, b) => b.totalEarned - a.totalEarned);
}

export const affiliates: Affiliate[] = makeAffiliates();

// The "current" affiliate for the portal preview — a strong performer.
export const currentAffiliate: Affiliate =
  affiliates.find((a) => a.status === "approved") ?? affiliates[0];

const PRODUCTS = ["Signature Wool Coat", "Cashmere Scarf", "Leather Weekender", "Silk Slip Dress", "Merino Crew", "Tailored Trouser", "Oxford Shirt", "Suede Loafer"];

function makeOrders(): Order[] {
  const active = affiliates.filter((a) => a.status === "approved");
  const list: Order[] = [];
  for (let i = 0; i < 60; i++) {
    const aff = pick(active);
    const subtotal = round2(between(48, 640));
    const days = Math.floor(between(0, 45));
    const refunded = rand() < 0.06;
    list.push({
      id: `order-${i + 1}`,
      shopifyOrderId: `${5300000 + i}`,
      orderNumber: `#${10842 + i}`,
      customerEmail: `customer${i + 1}@example.com`,
      subtotal,
      total: round2(subtotal * 1.08 + 6.5),
      currency: "USD",
      discountCodesUsed: [aff.code],
      isNewCustomer: rand() > 0.4,
      financialStatus: refunded ? "refunded" : "paid",
      affiliateName: aff.name,
      createdAt: daysAgo(days),
    });
  }
  return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export const orders: Order[] = makeOrders();

function makeCommissions(): Commission[] {
  const active = affiliates.filter((a) => a.status === "approved");
  const list: Commission[] = [];
  const stateBag: Commission["status"][] = [
    "paid", "paid", "paid", "approved", "approved", "pending", "pending", "pending", "reversed",
  ];
  for (let i = 0; i < 68; i++) {
    const aff = pick(active);
    const orderTotal = round2(between(48, 640));
    const status = i < 3 ? "pending" : pick(stateBag);
    const days = Math.floor(between(0, 60));
    list.push({
      id: `comm-${i + 1}`,
      orderNumber: `#${10842 + i}`,
      affiliateId: aff.id,
      affiliateName: aff.name,
      affiliateCode: aff.code,
      amount: round2((orderTotal * 15) / 100),
      currency: "USD",
      attributedBy: rand() > 0.25 ? "coupon" : "link",
      status,
      orderTotal,
      approvableAt: status === "pending" ? daysAgo(-Math.floor(between(2, 26))) : null,
      createdAt: daysAgo(days),
    });
  }
  return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export const commissions: Commission[] = makeCommissions();

export const payouts: Payout[] = [
  {
    id: "payout-3",
    senderBatchId: "AFF-2026-07-01",
    paypalBatchId: "5X7A9B2C1D3E4",
    status: "success",
    totalAmount: 18420.55,
    affiliateCount: 27,
    createdAt: daysAgo(12),
    items: affiliates.slice(0, 6).map((a) => ({
      affiliateName: a.name,
      affiliateEmail: a.paypalEmail ?? a.email,
      amount: round2(between(120, 1800)),
      transactionStatus: "SUCCESS",
    })),
  },
  {
    id: "payout-2",
    senderBatchId: "AFF-2026-06-01",
    paypalBatchId: "9K2M4N6P8Q1R3",
    status: "success",
    totalAmount: 15980.0,
    affiliateCount: 24,
    createdAt: daysAgo(42),
    items: affiliates.slice(2, 7).map((a) => ({
      affiliateName: a.name,
      affiliateEmail: a.paypalEmail ?? a.email,
      amount: round2(between(120, 1600)),
      transactionStatus: rand() > 0.9 ? "UNCLAIMED" : "SUCCESS",
    })),
  },
  {
    id: "payout-1",
    senderBatchId: "AFF-2026-05-01",
    paypalBatchId: "1A3B5C7D9E2F4",
    status: "success",
    totalAmount: 12240.75,
    affiliateCount: 19,
    createdAt: daysAgo(73),
    items: affiliates.slice(1, 5).map((a) => ({
      affiliateName: a.name,
      affiliateEmail: a.paypalEmail ?? a.email,
      amount: round2(between(120, 1400)),
      transactionStatus: "SUCCESS",
    })),
  },
];

export const messages: Message[] = [
  {
    id: "msg-1",
    subject: "July bonus: earn 5% extra all month",
    body: "We're doubling down this summer. Every sale you drive through July earns a 5% bonus on top of your standard rate.",
    channel: "email",
    audienceLabel: "All approved affiliates",
    recipients: 71,
    openRate: 62.4,
    scheduledFor: null,
    sentAt: daysAgo(6),
  },
  {
    id: "msg-2",
    subject: "New creative pack: Autumn Collection",
    body: "Fresh banners and product shots are live in your Assets tab. Grab them before the drop.",
    channel: "email",
    audienceLabel: "Social & Video",
    recipients: 27,
    openRate: 71.1,
    scheduledFor: null,
    sentAt: daysAgo(19),
  },
  {
    id: "msg-3",
    subject: "You're invited to the Elite Circle",
    body: "Your numbers put you in our top tier. Here's what changes: 25% commission, faster payouts, early drops.",
    channel: "email",
    audienceLabel: "VIP Creators",
    recipients: 8,
    openRate: null,
    scheduledFor: daysAgo(-2),
    sentAt: null,
  },
];

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    name: "Summer Sprint",
    bonusType: "percent",
    bonusValue: 5,
    startsAt: daysAgo(6),
    endsAt: daysAgo(-15),
    groupName: "All affiliates",
    status: "live",
  },
  {
    id: "promo-2",
    name: "Autumn Launch Bonus",
    bonusType: "flat",
    bonusValue: 10,
    startsAt: daysAgo(-30),
    endsAt: daysAgo(-44),
    groupName: "Social & Video",
    status: "scheduled",
  },
  {
    id: "promo-3",
    name: "Spring Kickoff",
    bonusType: "percent",
    bonusValue: 8,
    startsAt: daysAgo(120),
    endsAt: daysAgo(90),
    groupName: "VIP Creators",
    status: "ended",
  },
];

const GRADS = [
  "linear-gradient(135deg,#0f3d2e,#134e37)",
  "linear-gradient(135deg,#3a2f14,#6b5326)",
  "linear-gradient(135deg,#1b2a4a,#2a3f6b)",
  "linear-gradient(135deg,#3a1f2e,#5a2f45)",
  "linear-gradient(135deg,#14332b,#1f5a48)",
  "linear-gradient(135deg,#2b2b30,#45454d)",
];
export const assets: Asset[] = [
  { id: "as-1", title: "Autumn Hero — Wide", kind: "banner", dimensions: "1600×600", gradient: GRADS[0] },
  { id: "as-2", title: "Instagram Story Set", kind: "image", dimensions: "1080×1920", gradient: GRADS[1] },
  { id: "as-3", title: "Signature Coat — Product", kind: "image", dimensions: "1200×1200", gradient: GRADS[2] },
  { id: "as-4", title: "Launch Copy Snippets", kind: "copy", dimensions: "Text", gradient: GRADS[3] },
  { id: "as-5", title: "Square Feed Banner", kind: "banner", dimensions: "1080×1080", gradient: GRADS[4] },
  { id: "as-6", title: "Unboxing Reel Template", kind: "video", dimensions: "1080×1920", gradient: GRADS[5] },
];

// --- Time series ---
export function earningsSeries(days = 30, base = 220): TimePoint[] {
  const gen = mulberry32(days * 7 + 3);
  const out: TimePoint[] = [];
  let trend = base;
  for (let i = days - 1; i >= 0; i--) {
    trend += (gen() - 0.42) * base * 0.18;
    trend = Math.max(base * 0.35, trend);
    const weekend = new Date(NOW - i * DAY).getUTCDay();
    const boost = weekend === 0 || weekend === 6 ? 1.28 : 1;
    const earnings = round2(trend * boost);
    const clicks = Math.floor(earnings * between(2.2, 3.6));
    const ordersN = Math.max(1, Math.floor(earnings / between(28, 52)));
    out.push({ date: daysAgo(i), earnings, orders: ordersN, clicks });
  }
  return out;
}

export const adminKpis: AdminKpis = {
  affiliateRevenue: 486_240,
  affiliateRevenueDelta: 18.4,
  activeAffiliates: 71,
  activeAffiliatesDelta: 6.2,
  pendingCommissions: 12_840.5,
  pendingCommissionsCount: 34,
  refundRate: 3.1,
  refundRateDelta: -0.4,
  payableNow: 9_420.25,
  awaitingApproval: 4,
};

export function affiliateSummary(a: Affiliate) {
  return {
    pending: a.pendingEarnings,
    approved: a.approvedEarnings,
    paidLifetime: a.paidEarnings,
    thisMonth: round2(a.approvedEarnings * 0.42 + a.pendingEarnings * 0.6),
    nextPayoutDate: daysAgo(-11),
    payoutMinimum: 25,
  };
}
