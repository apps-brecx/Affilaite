"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, affiliates, programs, campaigns, affiliateCampaigns, discountCodes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getEarningsSeries } from "@/lib/queries";
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
});

export async function applyAsAffiliate(input: unknown): Promise<ActionResult & { affiliateId?: string }> {
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await db.query.users.findFirst({ where: eq(users.email, data.email.toLowerCase()) });
  if (existing) return { ok: false, message: "An account with this email already exists." };

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
      companyName: data.companyName || null,
      channel: data.channel || null,
      audienceSize: data.audienceSize || null,
      applyNote: data.applyNote || null,
      programId: defaultProgram?.id ?? null,
      socialLinks,
    })
    .returning();

  revalidatePath("/admin/affiliates");
  revalidatePath("/admin");
  return { ok: true, message: "Application received", affiliateId: aff.id };
}

const joinSchema = z.object({
  slug: z.string(),
  name: z.string().min(2, "Please enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/** Public campaign signup. Behavior depends on the campaign's access type. */
export async function joinCampaign(input: unknown): Promise<ActionResult & { instant?: boolean }> {
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const campaign = await db.query.campaigns.findFirst({ where: eq(campaigns.slug, data.slug) });
  if (!campaign) return { ok: false, message: "Campaign not found." };
  if (campaign.access === "invite") return { ok: false, message: "This campaign is invite-only." };
  if (campaign.status !== "active") return { ok: false, message: "This campaign isn't accepting signups right now." };

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
      programId: program?.id ?? null,
    })
    .returning();

  await db.insert(affiliateCampaigns).values({ affiliateId: aff.id, campaignId: campaign.id });

  // Instant access → issue a code immediately.
  if (instant) {
    const percent = program && program.commissionType === "percent" ? Number(program.commissionValue) : 15;
    const code = `${refCode}${percent}`.toUpperCase();
    await db
      .insert(discountCodes)
      .values({ affiliateId: aff.id, code, percentage: percent.toString(), active: true })
      .onConflictDoNothing();
  }

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
  name: z.string().min(2),
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
  if (!parsed.success) return { ok: false, message: "Invalid input." };
  const { name, companyName, instagram, website } = parsed.data;

  await db.update(users).set({ name }).where(eq(users.id, userId));
  await db
    .update(affiliates)
    .set({ companyName: companyName || null, socialLinks: { instagram: instagram ?? "", website: website ?? "" } })
    .where(eq(affiliates.id, affiliateId));
  revalidatePath("/settings");
  return { ok: true, message: "Profile updated." };
}
