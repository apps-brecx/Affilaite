"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, affiliates, programs, campaigns, affiliateCampaigns, discountCodes, sampleRequests } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getEarningsSeries, getAffiliate } from "@/lib/queries";
import { isPhoneRecentlyVerified, normalizePhone, phoneVerificationRequired } from "@/lib/phone";
import { normalizeAddress, composeAddress } from "@/lib/address";
import { createDiscountForAffiliate, uniqueDiscountCode } from "@/lib/discounts";
import { shopifyReady } from "@/lib/integrations";
import { sendEmailSafe } from "@/lib/email";
import { APP_URL } from "@/lib/links";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import type { TimePoint } from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };

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

    // Phone verification (Venmo payouts pay to this number). Admin-toggleable.
    const phone = data.phone ? normalizePhone(data.phone) : null;
    const verified = phone ? await isPhoneRecentlyVerified(phone) : false;
    if (await phoneVerificationRequired()) {
      if (!phone) return { ok: false, message: "Enter and verify your phone number to continue." };
      if (!verified) return { ok: false, message: "Please verify your phone number with the code we sent." };
    }

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

    await sendEmailSafe(
      data.email,
      "We got your application 🎉",
      `Hi ${data.name},\n\nThanks for applying to the Sipfluence partner program. We're reviewing your details and will email you as soon as you're approved.`,
    );

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
  if (instant) {
    const percent = program && program.commissionType === "percent" ? Number(program.commissionValue) : 15;
    const code = await uniqueDiscountCode(`${refCode}${percent}`);
    let shopifyDiscountId: string | null = null;
    if (await shopifyReady()) {
      try {
        shopifyDiscountId = await createDiscountForAffiliate(code, percent);
      } catch (e) {
        console.error("[joinCampaign] Shopify code creation failed:", e);
      }
    }
    await db
      .insert(discountCodes)
      .values({ affiliateId: aff.id, code, percentage: percent.toString(), shopifyDiscountId, active: true })
      .onConflictDoNothing();
  }

  await sendEmailSafe(
    email,
    instant ? "You're in! 🎉" : "We got your application 🎉",
    instant
      ? `Hi ${data.name},\n\nYour Sipfluence partner account is ready. Sign in to grab your code and referral link.\n\n${APP_URL}/login`
      : `Hi ${data.name},\n\nThanks for applying — we're reviewing your details and will email you once you're approved.`,
  );

  revalidatePath("/admin/affiliates");
  revalidatePath(`/admin/campaigns/${campaign.id}`);
  return {
    ok: true,
    instant,
    message: instant
      ? "You're in! Sign in to grab your code and link."
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

export const NOTIF_PREF_KEYS = ["newCommission", "payoutSent", "programUpdates"] as const;

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
  const { name, email, phone, companyName, instagram, website } = parsed.data;

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
      socialLinks: { instagram: instagram ?? "", website: website ?? "" },
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
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  const parsed = sampleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;

  const me = await getAffiliate(affiliateId);
  if (!me) return { ok: false, message: "Affiliate not found." };
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
