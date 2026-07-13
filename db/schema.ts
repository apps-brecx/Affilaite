// db/schema.ts — Affilaite data model (Neon Postgres via Drizzle)
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["admin", "affiliate"]);
export const affiliateStatus = pgEnum("affiliate_status", [
  "pending",
  "approved",
  "rejected",
  "suspended",
]);
export const commissionStatus = pgEnum("commission_status", [
  "pending",
  "approved",
  "reversed",
  "paid",
  "rejected",
]);
export const payoutStatus = pgEnum("payout_status", [
  "draft",
  "processing",
  "success",
  "failed",
]);
export const commissionType = pgEnum("commission_type", ["percent", "flat"]);

// --- Users (admin + affiliates share auth, differ by role) ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: roleEnum("role").notNull().default("affiliate"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Program = a commission ruleset ---
export const programs = pgTable("programs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  commissionType: commissionType("commission_type").notNull().default("percent"),
  commissionValue: numeric("commission_value", { precision: 8, scale: 2 }).notNull(),
  cookieWindowDays: integer("cookie_window_days").notNull().default(30),
  holdDays: integer("hold_days").notNull().default(30),
  payoutMinimum: numeric("payout_minimum", { precision: 8, scale: 2 }).default("0"),
  newCustomerOnly: boolean("new_customer_only").default(false),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Groups (segments) ---
export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Affiliate profile (1:1 with a user) ---
export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    status: affiliateStatus("status").notNull().default("pending"),
    refCode: text("ref_code").notNull().unique(),
    paypalEmail: text("paypal_email"),
    programId: uuid("program_id").references(() => programs.id),
    groupId: uuid("group_id").references(() => groups.id),
    companyName: text("company_name"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>(),
    totalEarned: numeric("total_earned", { precision: 12, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ refIdx: index("aff_ref_idx").on(t.refCode) }),
);

// --- Discount codes issued to affiliates (mirrors Shopify) ---
export const discountCodes = pgTable(
  "discount_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateId: uuid("affiliate_id").references(() => affiliates.id),
    code: text("code").notNull().unique(),
    shopifyPriceRuleId: text("shopify_price_rule_id"),
    shopifyDiscountId: text("shopify_discount_id"),
    percentage: numeric("percentage", { precision: 5, scale: 2 }),
    active: boolean("active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ codeIdx: index("code_idx").on(t.code) }),
);

// --- Click log (link attribution backup) ---
export const clicks = pgTable(
  "clicks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateId: uuid("affiliate_id").references(() => affiliates.id),
    visitorId: text("visitor_id"),
    landingUrl: text("landing_url"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ visitorIdx: index("click_visitor_idx").on(t.visitorId) }),
);

// --- Orders mirrored from Shopify webhooks ---
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopifyOrderId: text("shopify_order_id").notNull().unique(),
  orderNumber: text("order_number"),
  customerEmail: text("customer_email"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }),
  total: numeric("total", { precision: 12, scale: 2 }),
  currency: text("currency").default("USD"),
  discountCodesUsed: jsonb("discount_codes_used").$type<string[]>(),
  isNewCustomer: boolean("is_new_customer"),
  financialStatus: text("financial_status"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Payout batches (mirrors PayPal) ---
export const payouts = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  senderBatchId: text("sender_batch_id").notNull().unique(),
  paypalBatchId: text("paypal_batch_id"),
  status: payoutStatus("status").notNull().default("draft"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }),
  affiliateCount: integer("affiliate_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Commissions (the money) ---
export const commissions = pgTable(
  "commissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.id),
    affiliateId: uuid("affiliate_id").references(() => affiliates.id),
    programId: uuid("program_id").references(() => programs.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("USD"),
    attributedBy: text("attributed_by"),
    status: commissionStatus("status").notNull().default("pending"),
    approvableAt: timestamp("approvable_at"),
    payoutId: uuid("payout_id").references(() => payouts.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    affIdx: index("comm_aff_idx").on(t.affiliateId),
    statusIdx: index("comm_status_idx").on(t.status),
  }),
);

export const payoutItems = pgTable("payout_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  payoutId: uuid("payout_id").references(() => payouts.id),
  affiliateId: uuid("affiliate_id").references(() => affiliates.id),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  paypalItemId: text("paypal_item_id"),
  transactionStatus: text("transaction_status"),
});

// --- Messaging ---
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject"),
  body: text("body"),
  audience: jsonb("audience").$type<{ groupIds?: string[]; status?: string[] }>(),
  channel: text("channel").default("email"),
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promotions = pgTable("promotions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  bonusType: commissionType("bonus_type").default("percent"),
  bonusValue: numeric("bonus_value", { precision: 8, scale: 2 }),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  groupId: uuid("group_id").references(() => groups.id),
});

// --- Creative assets ---
export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").default("banner"), // banner | image | copy | video
  url: text("url"),
  dimensions: text("dimensions"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Raw webhook log (audit + replay) ---
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source"),
    topic: text("topic"),
    externalId: text("external_id"),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ dedupeIdx: index("wh_dedupe_idx").on(t.source, t.externalId) }),
);
