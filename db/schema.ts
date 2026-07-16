// db/schema.ts — Affilaite data model (Neon Postgres via Drizzle)
import { sql } from "drizzle-orm";
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
  uniqueIndex,
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
export const payoutMethod = pgEnum("payout_method", ["paypal", "venmo"]);
export const campaignType = pgEnum("campaign_type", ["affiliate", "referral"]);
export const campaignStatus = pgEnum("campaign_status", ["active", "paused", "ended"]);
export const campaignAccess = pgEnum("campaign_access", ["instant", "approval", "invite"]);
export const sampleStatus = pgEnum("sample_status", ["requested", "approved", "rejected", "shipped"]);

// --- Users (admin + affiliates share auth, differ by role) ---
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"),
  role: roleEnum("role").notNull().default("affiliate"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Password reset tokens (hashed, single-use, expiring) ---
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ tokenIdx: index("reset_token_idx").on(t.tokenHash) }),
);

// --- Phone verification codes (SMS OTP at signup; hashed, expiring, capped) ---
export const phoneVerifications = pgTable(
  "phone_verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ phoneIdx: index("phone_verif_idx").on(t.phone) }),
);

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

// --- Group chat (WhatsApp-style broadcast group) ---
// Admins post; affiliates read (and vote on polls) but never see each other.
export const groupMessages = pgTable(
  "group_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id").notNull().references(() => groups.id),
    senderId: uuid("sender_id").references(() => users.id), // the admin who posted
    body: text("body"),
    // [{ type: "image" | "video" | "file", url, name }]
    attachments: jsonb("attachments").$type<{ type: string; url: string; name?: string }[]>(),
    // { question, options: string[] } — null when not a poll
    poll: jsonb("poll").$type<{ question: string; options: string[] }>(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ gmGroupIdx: index("gm_group_idx").on(t.groupId) }),
);

export const groupMessageReads = pgTable(
  "group_message_reads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").notNull().references(() => groupMessages.id),
    affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
    readAt: timestamp("read_at").defaultNow(),
  },
  (t) => ({
    gmrMsgIdx: index("gmr_msg_idx").on(t.messageId),
    gmrUniq: uniqueIndex("gmr_msg_aff_uniq").on(t.messageId, t.affiliateId),
  }),
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").notNull().references(() => groupMessages.id),
    affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
    optionIndex: integer("option_index").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    pvMsgIdx: index("pv_msg_idx").on(t.messageId),
    pvUniq: uniqueIndex("pv_msg_aff_uniq").on(t.messageId, t.affiliateId),
  }),
);

// --- Affiliate profile (1:1 with a user) ---
export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id),
    status: affiliateStatus("status").notNull().default("pending"),
    refCode: text("ref_code").notNull().unique(),
    paypalEmail: text("paypal_email"),
    // Payout rail: Venmo pays to a (verified) phone; PayPal pays to an email.
    payoutMethod: payoutMethod("payout_method").notNull().default("venmo"),
    phone: text("phone"),
    phoneVerifiedAt: timestamp("phone_verified_at"),
    // Shipping address for product samples (opt-in). `address` holds a composed
    // single-line copy for display/Shopify; the structured parts back the forms.
    address: text("address"),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    region: text("region"),
    postalCode: text("postal_code"),
    country: text("country"),
    // Admin can bar an affiliate from requesting product samples (abuse control).
    samplesBanned: boolean("samples_banned").notNull().default(false),
    programId: uuid("program_id").references(() => programs.id),
    groupId: uuid("group_id").references(() => groups.id),
    companyName: text("company_name"),
    channel: text("channel"),
    audienceSize: text("audience_size"),
    applyNote: text("apply_note"),
    socialLinks: jsonb("social_links").$type<Record<string, string>>(),
    notificationPrefs: jsonb("notification_prefs").$type<Record<string, boolean>>(),
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
  (t) => ({
    codeIdx: index("code_idx").on(t.code),
    dcAffIdx: index("dc_aff_idx").on(t.affiliateId),
  }),
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
  (t) => ({
    visitorIdx: index("click_visitor_idx").on(t.visitorId),
    clickAffIdx: index("click_aff_idx").on(t.affiliateId),
  }),
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
    // Fraud review: flagged commissions are held out of auto-approval and
    // surface in the admin review queue until an admin approves/rejects.
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    payoutId: uuid("payout_id").references(() => payouts.id),
    // Which campaign's rules produced this commission (if any) — drives
    // per-campaign reward rates, gates, and per-affiliate caps.
    campaignId: uuid("campaign_id").references(() => campaigns.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    affIdx: index("comm_aff_idx").on(t.affiliateId),
    statusIdx: index("comm_status_idx").on(t.status),
    orderIdx: index("comm_order_idx").on(t.orderId), // refund/clawback lookups
    payoutIdx: index("comm_payout_idx").on(t.payoutId), // payout claim/release
    approvableIdx: index("comm_approvable_idx").on(t.approvableAt), // cron maturation
    campaignIdx: index("comm_campaign_idx").on(t.campaignId), // per-campaign caps
    // At most one *positive* commission per order (negative refund adjustments
    // are exempt so post-payout clawbacks can be netted against later batches).
    orderPositiveUniq: uniqueIndex("comm_order_positive_uniq")
      .on(t.orderId)
      .where(sql`${t.amount} >= 0`),
  }),
);

export const payoutItems = pgTable(
  "payout_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payoutId: uuid("payout_id").references(() => payouts.id),
    affiliateId: uuid("affiliate_id").references(() => affiliates.id),
    amount: numeric("amount", { precision: 12, scale: 2 }),
    currency: text("currency").default("USD"),
    paypalItemId: text("paypal_item_id"),
    transactionStatus: text("transaction_status"),
  },
  (t) => ({
    piPayoutIdx: index("pi_payout_idx").on(t.payoutId),
    piAffIdx: index("pi_aff_idx").on(t.affiliateId),
  }),
);

// --- Messaging ---
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  subject: text("subject"),
  body: text("body"),
  audience: jsonb("audience").$type<{ groupIds?: string[]; status?: string[] }>(),
  channel: text("channel").default("email"),
  recipientCount: integer("recipient_count").default(0),
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
  // Optional featured product from the Shopify catalog.
  productId: text("product_id"),
  productTitle: text("product_title"),
  productImage: text("product_image"),
  productUrl: text("product_url"),
});

// --- Sample requests (affiliates ask for product samples; admin approves) ---
export const sampleRequests = pgTable(
  "sample_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
    productId: text("product_id"), // Shopify product GID (nullable for a freeform ask)
    productTitle: text("product_title"),
    productImage: text("product_image"),
    productUrl: text("product_url"),
    note: text("note"), // affiliate's message
    addressSnapshot: text("address_snapshot"), // shipping address at request time
    status: sampleStatus("status").notNull().default("requested"),
    shopifyOrderId: text("shopify_order_id"), // draft order id once created
    adminNote: text("admin_note"),
    // Fulfillment / shipping (from Shopify or entered by an admin on ship).
    carrier: text("carrier"),
    trackingNumber: text("tracking_number"),
    trackingUrl: text("tracking_url"),
    shippedAt: timestamp("shipped_at"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ sampleAffIdx: index("sample_aff_idx").on(t.affiliateId), sampleStatusIdx: index("sample_status_idx").on(t.status) }),
);

// --- Creative assets ---
export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").default("banner"), // banner | image | copy | video
  url: text("url"),
  dimensions: text("dimensions"),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Per-affiliate notifications (drives the sidebar unread badges) ---
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
    // Which portal section this relates to: dashboard | links | promotions |
    // performance | payouts | assets | community.
    section: text("section").notNull().default("dashboard"),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ notifAffIdx: index("notif_aff_idx").on(t.affiliateId) }),
);

// --- Campaigns (affiliate + referral, ReferralCandy-style) ---
export const campaigns = pgTable("campaigns", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  type: campaignType("type").notNull().default("affiliate"),
  status: campaignStatus("status").notNull().default("active"),
  access: campaignAccess("access").notNull().default("approval"),
  slug: text("slug").unique(),                       // campaign URL: /join/<slug>
  shortCode: text("short_code"),                     // prefix for generated codes
  destinationUrl: text("destination_url"),           // where referral links land
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  description: text("description"),
  codePrefix: text("code_prefix"),
  config: jsonb("config"),                           // rich rewards & rules (see lib/campaign-config)
  // Advocate/affiliate reward (commission for affiliate campaigns; "give" for referral)
  rewardType: commissionType("reward_type").default("percent"),
  rewardValue: numeric("reward_value", { precision: 8, scale: 2 }),
  // Friend reward — referral campaigns only ("get")
  friendRewardType: commissionType("friend_reward_type").default("percent"),
  friendRewardValue: numeric("friend_reward_value", { precision: 8, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// --- Global app settings (key/value) ---
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const affiliateCampaigns = pgTable(
  "affiliate_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    affiliateId: uuid("affiliate_id").notNull().references(() => affiliates.id),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({ pairIdx: index("aff_camp_idx").on(t.affiliateId, t.campaignId) }),
);

// --- Invite email templates (admin-designed) ---
export const inviteTemplates = pgTable("invite_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isDefault: boolean("is_default").default(false),
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
  // Unique so an insert is the idempotency gate against concurrent Shopify
  // retries (check-then-insert races otherwise let two deliveries both through).
  (t) => ({ dedupeIdx: uniqueIndex("wh_dedupe_idx").on(t.source, t.externalId) }),
);
