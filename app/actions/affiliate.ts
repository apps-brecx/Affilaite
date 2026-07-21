"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, affiliates, programs, campaigns, affiliateCampaigns, discountCodes, sampleRequests, groupMessages, groupMessageReads, pollVotes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { approvedAffiliateId } from "@/lib/session";
import { getEarningsSeries, getAffiliate } from "@/lib/queries";
import { isPhoneRecentlyVerified, normalizePhone, phoneVerificationRequired } from "@/lib/phone";
import { normalizeAddress, composeAddress } from "@/lib/address";
import { createDiscountForAffiliate, uniqueDiscountCode, customerDiscountFromConfig, resolveCampaignDiscountOptions } from "@/lib/discounts";
import { mergeConfig } from "@/lib/campaign-config";
import { getCustomerPrefill, type CustomerPrefill } from "@/lib/shopify-customers";
import { shopifyReady } from "@/lib/integrations";
import { dispatchEmail } from "@/lib/email-center";
import { APP_URL } from "@/lib/links";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { TimePoint } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };

/**
 * Apply-page convenience: if the entered email already belongs to a store
 * customer, return their name + shipping address to pre-fill the form. Best
 * effort — returns null when unavailable (store not connected, no such customer,
 * or Shopify's Protected Customer Data blocks the PII). Rate-limited to blunt
 * email-enumeration abuse of a public endpoint.
 */
export async function lookupCustomerForApply(email: string): Promise<CustomerPrefill | null> {
  const clean = (email ?? "").trim().toLowerCase();
  if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return null;
  const ip = await clientIp();
  if (!rateLimit(`apply-lookup:${ip}`, 12, 60_000).ok) return null;
  // Don't reveal existing partners' details through this endpoint.
  if (db) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, clean) });
    if (existing) return null;
  }
  return getCustomerPrefill(clean);
}

export type EarningsRange = "today" | "week" | "month" | "year" | "all";

const RANGE_DAYS: Record<EarningsRange, number> = { today: 1, week: 7, month: 30, year: 365, all: 3650 };

/** Earnings series for the signed-in affiliate over the chosen range. */
export async function getMyEarnings(range: EarningsRange): Promise<TimePoint[]> {
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return [];
  return getEarningsSeries(RANGE_DAYS[range] ?? 30, affiliateId);
}

function slugCode(name: string) {
  return (name.split(/\s+/)[0] || "PARTNER").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || "PARTNER";
}

async function uniqueRefCode(base: string) {
  if (!db) return base;
  let code = base;
  let n = 1;
  while (await db.query.affiliates.findFirst({ where: eq(affiliates.refCode, code) })) {
    code = `${base}${n++}`;
  }
  return code;
}

const applySchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  companyName: z.string().optional(),
  channel: z.string().optional(),
  audienceSize: z.string().optional(),
  handle: z.string().optional(),
  applyNote: z.string().optional(),
  paypalEmail: z.string().email("Enter a valid PayPal email").optional().or(z.literal("")),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
});

export async function applyAsAffiliate(input: unknown): Promise<ActionResult & { affiliateId?: string }> {
  if (!db) return { ok: false, message: "Database not configured." };
  try {
    if (!rateLimit(`apply:${await clientIp()}`, 5, 10 * 60_000).ok) {
      return { ok: false, message: "Too many attempts — please try again in a few minutes." };
    }
    const parsed = applySchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input" };
    const data = parsed.data;

    // Phone is optional on the application itself — the applicant can skip it and
    // add/verify a Venmo number later (before any payout). If they DID provide
    // one, only trust it when it's actually been verified.
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const verified = phone ? await isPhoneRecentlyVerified(phone) : false;

    const existing = await db.query.users.findFirst({ where: eq(users.email, data.email.toLowerCase()) });
    if (existing) return { ok: false, message: "An account with this email already exists." };

    const addr = normalizeAddress(data);
    const composed = composeAddress(addr);

    const passwordHash = await bcrypt.hash(data.password, 10);
    const [user] = await db
      .insert(users)
      .values({ email: data.email.toLowerCase(), name: data.name, passwordHash, role: "affiliate" })
      .returning();

    const defaultProgram = await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
    const refCode = await uniqueRefCode(slugCode(data.name));
    const socialLinks: Record<string, string> = data.handle ? { handle: data.handle } : {};

    const [aff] = await db
      .insert(affiliates)
      .values({
        userId: user.id,
        status: "pending",
        refCode,
        paypalEmail: data.paypalEmail || null,
        phone: phone ?? null,
        phoneVerifiedAt: verified ? new Date() : null,
        address: composed || null,
        addressLine1: addr.line1 || null,
        addressLine2: addr.line2 || null,
        city: addr.city || null,
        region: addr.region || null,
        postalCode: addr.postalCode || null,
        country: addr.country || null,
        companyName: data.companyName || null,
        channel: data.channel || null,
        audienceSize: data.audienceSize || null,
        applyNote: data.applyNote || null,
        programId: defaultProgram?.id ?? null,
        socialLinks,
      })
      .returning();

    await dispatchEmail("application_received", data.email, { name: data.name });

    revalidatePath("/admin/affiliates");
    revalidatePath("/admin");
    return { ok: true, message: "Application received", affiliateId: aff.id };
  } catch (e: any) {
    console.error("[applyAsAffiliate]", e);
    return { ok: false, message: "Something went wrong submitting your application. Please try again." };
  }
}

const joinSchema = z.object({
  slug: z.string(),
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().optional(),
});

/** Public campaign signup. Behavior depends on the campaign's access type. */
export async function joinCampaign(input: unknown): Promise<ActionResult & { instant?: boolean }> {
  if (!db) return { ok: false, message: "Database not configured." };
  if (!rateLimit(`join:${await clientIp()}`, 5, 10 * 60_000).ok) {
    return { ok: false, message: "Too many attempts — please try again in a few minutes." };
  }
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.slug, data.slug) });
  if (!campaign) return { ok: false, message: "Campaign not found." };
  if (campaign.access === "invite") return { ok: false, message: "This campaign is invite-only." };
  if (campaign.status !== "active") return { ok: false, message: "This campaign isn't accepting signups right now." };

  const phone = data.phone ? normalizePhone(data.phone) : null;
  const verified = phone ? await isPhoneRecentlyVerified(phone) : false;
  if (await phoneVerificationRequired()) {
    if (!phone) return { ok: false, message: "Enter and verify your phone number to continue." };
    if (!verified) return { ok: false, message: "Please verify your phone number with the code we sent." };
  }

  const email = data.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { ok: false, message: "An account with this email already exists — try signing in." };

  const instant = campaign.access === "instant";
  const passwordHash = await bcrypt.hash(data.password, 10);
  const [user] = await db.insert(users).values({ email, name: data.name, passwordHash, role: "affiliate" }).returning();

  const program = await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
  const base = `${campaign.shortCode ?? ""}${slugCode(data.name)}`.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const refCode = await uniqueRefCode(base || slugCode(data.name));

  const [aff] = await db
    .insert(affiliates)
    .values({
      userId: user.id,
      status: instant ? "approved" : "pending",
      refCode,
      phone: phone ?? null,
      phoneVerifiedAt: verified ? new Date() : null,
      programId: program?.id ?? null,
    })
    .returning();

  await db.insert(affiliateCampaigns).values({ affiliateId: aff.id, campaignId: campaign.id });

  // Instant access → issue a code immediately (and push it to Shopify so it
  // actually works at checkout, not just locally).
  let codeSyncFailed = false;
  if (instant) {
    const cfg = mergeConfig(campaign.config);
    // The customer discount on the code reflects the campaign's configured
    // reward — and, for referral campaigns, the friend/customer coupon — instead
    // of the program default or a hardcoded 15%.
    const cust = customerDiscountFromConfig(cfg, program);
    const code = await uniqueDiscountCode(`${refCode}${Math.round(cust.value)}`);
    let shopifyDiscountId: string | null = null;
    if (await shopifyReady()) {
      try {
        // Honor the campaign's coupon rules (expiry, combines-with, min-order,
        // applies-to collections) so the "Coupon settings" panel isn't cosmetic.
        const options = await resolveCampaignDiscountOptions(cfg, campaign.endsAt);
        options.valueType = cust.valueType;
        shopifyDiscountId = await createDiscountForAffiliate(code, cust.value, options);
      } catch (e) {
        console.error("[joinCampaign] Shopify code creation failed:", e);
        codeSyncFailed = true;
      }
    }
    await db
      .insert(discountCodes)
      // campaignId ties the code to THIS campaign so attribution maps a used
      // coupon straight to it (not the affiliate's most-recently-joined one).
      .values({ affiliateId: aff.id, campaignId: campaign.id, code, percentage: cust.value.toString(), shopifyDiscountId, active: true })
      .onConflictDoNothing();
  }

  await dispatchEmail(instant ? "instant_welcome" : "application_received", email, {
    name: data.name,
    loginUrl: `${APP_URL}/login`,
  });

  revalidatePath("/admin/affiliates");
  revalidatePath(`/admin/campaigns/${campaign.id}`);
  return {
    ok: true,
    instant,
    message: instant
      ? codeSyncFailed
        ? "You're in! Sign in to grab your link. (We're finalizing your discount code — it'll be active shortly.)"
        : "You're in! Sign in to grab your code and link."
      : "Application received — we'll review it and email you once you're approved.",
  };
}

/** Save a verified Venmo payout phone. Requires the number to be verified first. */
export async function updatePayoutPhone(phoneRaw: string): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  const phone = normalizePhone(phoneRaw);
  if (!phone) return { ok: false, message: "Enter a valid phone number." };
  if (!(await isPhoneRecentlyVerified(phone))) {
    return { ok: false, message: "Verify this number with the code we texted before saving." };
  }
  await db
    .update(affiliates)
    .set({ phone, phoneVerifiedAt: new Date(), payoutMethod: "venmo" })
    .where(eq(affiliates.id, affiliateId));
  revalidatePath("/payouts");
  return { ok: true, message: "Venmo payout number saved." };
}

/**
 * Link the affiliate to the Shopify customer with the same email. Used by the
 * "Link my Shopify account" button in Settings (and its Retry).
 */
export async function linkShopifyAccount(): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!(await shopifyReady())) return { ok: false, message: "The store isn't connected yet — try again later." };

  const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  if (!aff) return { ok: false, message: "Account not found." };
  const user = await db.query.users.findFirst({ where: eq(users.id, aff.userId) });
  const email = user?.email;
  if (!email) return { ok: false, message: "No email on file to match." };

  const { findShopifyCustomerByEmail } = await import("@/lib/shopify-customers");
  const { id, error } = await findShopifyCustomerByEmail(email);
  if (error) return { ok: false, message: `Couldn't check Shopify: ${error}` };
  if (!id) {
    return { ok: false, message: `No Syruvia account found for ${email}.` };
  }
  await db.update(affiliates).set({ shopifyCustomerId: id }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/settings");
  revalidatePath("/orders");
  revalidatePath("/vip");
  return { ok: true, message: `Linked to your Syruvia account (${email}).` };
}

/** Remove the Shopify customer link from the affiliate. */
export async function unlinkShopifyAccount(): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  await db.update(affiliates).set({ shopifyCustomerId: null }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/settings");
  revalidatePath("/orders");
  revalidatePath("/vip");
  return { ok: true, message: "Unlinked from your Syruvia account." };
}

// Kept module-local: a "use server" file may only export async functions, so
// this must NOT be exported (doing so throws "can only export async functions").
const NOTIF_PREF_KEYS = ["newCommission", "payoutSent", "programUpdates"] as const;

/** Persist the affiliate's email notification preferences. */
export async function updateNotificationPrefs(prefs: Record<string, boolean>): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  const clean: Record<string, boolean> = {};
  for (const k of NOTIF_PREF_KEYS) clean[k] = prefs[k] !== false;
  await db.update(affiliates).set({ notificationPrefs: clean }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/settings");
  return { ok: true, message: "Notification preferences saved." };
}

export async function updatePaypalEmail(email: string): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  const check = z.string().email().safeParse(email);
  if (!check.success) return { ok: false, message: "Enter a valid email." };
  await db.update(affiliates).set({ paypalEmail: email.toLowerCase() }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/payouts");
  return { ok: true, message: "Payout email saved." };
}

const profileSchema = z.object({
  name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  companyName: z.string().optional(),
  instagram: z.string().optional(),
  youtube: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
});

export async function updateProfile(input: unknown): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const userId = (session?.user as any)?.id;
  const affiliateId = (session?.user as any)?.affiliateId;
  if (!userId || !affiliateId) return { ok: false, message: "Not signed in." };
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const { name, email, phone, companyName, instagram, youtube, tiktok, website } = parsed.data;

  const newEmail = email.toLowerCase().trim();
  // Email is the login — enforce uniqueness before changing it.
  const clash = await db.query.users.findFirst({ where: eq(users.email, newEmail) });
  if (clash && clash.id !== userId) return { ok: false, message: "That email is already in use." };

  const current = await db.query.affiliates.findFirst({ where: eq(affiliates.id, affiliateId) });
  const normalizedPhone = phone && phone.trim() ? normalizePhone(phone) : null;
  if (phone && phone.trim() && !normalizedPhone) return { ok: false, message: "Enter a valid phone number." };
  // Changing the number means it's no longer the verified one.
  const phoneChanged = (normalizedPhone ?? null) !== (current?.phone ?? null);

  const addr = normalizeAddress(parsed.data);
  const composed = composeAddress(addr);

  await db.update(users).set({ name, email: newEmail }).where(eq(users.id, userId));
  await db
    .update(affiliates)
    .set({
      phone: normalizedPhone,
      ...(phoneChanged ? { phoneVerifiedAt: null } : {}),
      address: composed || null,
      addressLine1: addr.line1 || null,
      addressLine2: addr.line2 || null,
      city: addr.city || null,
      region: addr.region || null,
      postalCode: addr.postalCode || null,
      country: addr.country || null,
      companyName: companyName || null,
      socialLinks: { instagram: instagram ?? "", youtube: youtube ?? "", tiktok: tiktok ?? "", website: website ?? "" },
    })
    .where(eq(affiliates.id, affiliateId));
  revalidatePath("/settings");
  revalidatePath("/payouts");
  return { ok: true, message: "Profile updated." };
}

const sampleSchema = z.object({
  productId: z.string().optional(),
  productTitle: z.string().min(1, "Pick a product to request"),
  productImage: z.string().optional(),
  productUrl: z.string().optional(),
  note: z.string().optional(),
});

/** Affiliate requests a product sample (ships to their address on file). */
export async function requestSample(input: unknown): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const affiliateId = await approvedAffiliateId();
  if (!affiliateId) return { ok: false, message: "Your account isn't active." };
  const parsed = sampleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const me = await getAffiliate(affiliateId);
  if (!me) return { ok: false, message: "Affiliate not found." };
  if (me.samplesBanned) {
    return { ok: false, message: "Sample requests are disabled on your account. Contact the team if you think this is a mistake." };
  }
  if (!me.address || !me.address.trim()) {
    return { ok: false, message: "Add a shipping address in Settings before requesting samples." };
  }

  // Don't let the same product pile up while a request is still open.
  if (d.productId) {
    const open = await db.query.sampleRequests.findFirst({
      where: and(
        eq(sampleRequests.affiliateId, affiliateId),
        eq(sampleRequests.productId, d.productId),
        inArray(sampleRequests.status, ["requested", "approved"]),
      ),
    });
    if (open) return { ok: false, message: "You already have an open request for that product." };
  }

  await db.insert(sampleRequests).values({
    affiliateId,
    productId: d.productId || null,
    productTitle: d.productTitle,
    productImage: d.productImage || null,
    productUrl: d.productUrl || null,
    note: d.note || null,
    addressSnapshot: me.address,
    status: "requested",
  });
  revalidatePath("/samples");
  revalidatePath("/admin/samples");
  return { ok: true, message: "Sample requested — we'll review it shortly." };
}

/** Mark all messages in the affiliate's group as read (populates read receipts). */
export async function markGroupRead(): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  const me = await getAffiliate(affiliateId);
  if (!me?.groupId) return { ok: true, message: "No group." };
  const msgs = await db.select({ id: groupMessages.id }).from(groupMessages).where(eq(groupMessages.groupId, me.groupId));
  if (msgs.length) {
    await db
      .insert(groupMessageReads)
      .values(msgs.map((m) => ({ messageId: m.id, affiliateId })))
      .onConflictDoNothing();
  }
  return { ok: true, message: "ok" };
}

/** Cast (or change) the affiliate's vote on a poll message. */
export async function votePoll(messageId: string, optionIndex: number): Promise<ActionResult> {
  if (!db) return { ok: false, message: "Database not configured." };
  const affiliateId = await approvedAffiliateId();
  if (!affiliateId) return { ok: false, message: "Your account isn't active." };
  if (!Number.isInteger(optionIndex) || optionIndex < 0) return { ok: false, message: "Invalid option." };

  const msg = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, messageId) });
  const poll = msg?.poll as { options: string[] } | null;
  if (!msg || !poll?.options) return { ok: false, message: "Poll not found." };
  if (optionIndex >= poll.options.length) return { ok: false, message: "Invalid option." };
  // Only members of the message's group can vote.
  const me = await getAffiliate(affiliateId);
  if (!me || me.groupId !== msg.groupId) return { ok: false, message: "You're not in this group." };

  await db
    .insert(pollVotes)
    .values({ messageId, affiliateId, optionIndex })
    .onConflictDoUpdate({ target: [pollVotes.messageId, pollVotes.affiliateId], set: { optionIndex } });
  revalidatePath("/community");
  return { ok: true, message: "Vote recorded." };
}
