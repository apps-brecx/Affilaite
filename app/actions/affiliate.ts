"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users, affiliates, programs } from "@/db/schema";
import { auth } from "@/lib/auth";

export type ActionResult = { ok: boolean; message: string };

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
