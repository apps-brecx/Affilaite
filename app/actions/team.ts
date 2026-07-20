"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { APP_URL } from "@/lib/links";
import { emailReady } from "@/lib/integrations";
import { sendEmail } from "@/lib/email";
import {
  getEmailBrand,
  renderRichEmail,
  fillVars,
  getTeamInviteEmail,
  writeTeamInviteEmail,
  defaultTeamInviteEmail,
  type TeamInviteEmail,
} from "@/lib/email-center";
import { AREA_KEYS } from "@/lib/permissions";

type Result = { ok: boolean; message: string };
const PATH = "/admin/settings/team";

/** Only the owner may manage the team. */
async function requireOwnerSession() {
  const session = await auth();
  const u = session?.user as any;
  if (u?.role !== "admin") throw new Error("Unauthorized");
  if (!u?.isOwner) throw new Error("Only the owner can manage the team.");
  return u;
}

const cleanPerms = (perms: unknown): string[] =>
  Array.isArray(perms) ? [...new Set(perms.filter((p): p is string => typeof p === "string" && AREA_KEYS.includes(p)))] : [];

function tempPassword(): string {
  // Readable, unambiguous temp password.
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  return "Sip-" + Array.from(bytes, (b) => abc[b % abc.length]).join("");
}

async function emailInvite(email: string, name: string, temp: string): Promise<boolean> {
  if (!(await emailReady())) return false;
  const [tpl, brand] = await Promise.all([getTeamInviteEmail(), getEmailBrand()]);
  const vars = {
    name: name || "there",
    email,
    tempPassword: temp,
    // ?welcome=1 makes the login screen greet invited members with the custom
    // headline instead of "Welcome back".
    loginUrl: `${APP_URL}/login?welcome=1`,
    brand: brand.logoText || "Sipfluence",
  };
  const subject = fillVars(tpl.subject, vars) || `You've been added to the ${vars.brand} admin`;
  const buttonUrl = fillVars(tpl.buttonUrl || `${APP_URL}/login`, vars);
  const html = renderRichEmail({
    body: fillVars(tpl.body, vars),
    brand,
    preheader: fillVars(tpl.preheader, vars),
    imageUrl: tpl.imageUrl,
    buttonColor: tpl.buttonColor,
    cta: tpl.buttonLabel && buttonUrl ? { text: tpl.buttonLabel, url: buttonUrl } : undefined,
  });
  try {
    const res: any = await sendEmail(email, subject, html, tpl.fromName);
    return !res?.skipped;
  } catch (e) {
    console.error("[team] invite email:", e);
    return false;
  }
}

/** Save the team-invite email template (owner only). */
export async function saveTeamInviteEmail(input: unknown): Promise<Result> {
  await requireOwnerSession();
  const parsed = z
    .object({
      fromName: z.string().max(80).optional().default(""),
      subject: z.string().max(200).optional().default(""),
      preheader: z.string().max(200).optional().default(""),
      body: z.string().max(4000).optional().default(""),
      buttonLabel: z.string().max(60).optional().default(""),
      buttonUrl: z.string().max(500).optional().default(""),
      imageUrl: z.string().max(2_600_000).optional().default(""),
      buttonColor: z.string().max(9).optional().default(""),
      loginHeadline: z.string().max(80).optional().default(""),
      loginSubtext: z.string().max(160).optional().default(""),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid template." };
  const tpl: TeamInviteEmail = { ...defaultTeamInviteEmail(), ...parsed.data };
  await writeTeamInviteEmail(tpl);
  revalidatePath("/admin/settings/invites");
  return { ok: true, message: "Team invite email saved." };
}

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email."),
  name: z.string().max(80).optional(),
  permissions: z.array(z.string()).optional(),
});

export async function inviteTeamMember(input: unknown): Promise<Result> {
  await requireOwnerSession();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const email = parsed.data.email.toLowerCase().trim();
  const name = parsed.data.name?.trim() || email.split("@")[0];
  const permissions = cleanPerms(parsed.data.permissions);
  if (!permissions.length) return { ok: false, message: "Pick at least one area they can access." };

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) return { ok: false, message: "Someone with that email already exists." };

  const temp = tempPassword();
  const passwordHash = await bcrypt.hash(temp, 10);
  await db.insert(users).values({ email, name, passwordHash, role: "admin", isOwner: false, permissions });

  const sent = await emailInvite(email, name, temp);
  revalidatePath(PATH);
  return {
    ok: true,
    message: sent
      ? `${name} added — an invite with their temporary password was emailed.`
      : `${name} added. Email isn't connected, so share their temporary password: ${temp}`,
  };
}

export async function updateTeamPermissions(id: string, permissions: unknown): Promise<Result> {
  await requireOwnerSession();
  if (!db) return { ok: false, message: "Database not configured." };
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target || target.role !== "admin") return { ok: false, message: "Not a team member." };
  if (target.isOwner) return { ok: false, message: "The owner always has full access." };
  const perms = cleanPerms(permissions);
  if (!perms.length) return { ok: false, message: "Pick at least one area, or remove them instead." };
  await db.update(users).set({ permissions: perms }).where(eq(users.id, id));
  revalidatePath(PATH);
  return { ok: true, message: "Access updated." };
}

export async function removeTeamMember(id: string): Promise<Result> {
  const owner = await requireOwnerSession();
  if (!db) return { ok: false, message: "Database not configured." };
  if (id === owner.id) return { ok: false, message: "You can't remove yourself." };
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return { ok: false, message: "Not found." };
  if (target.isOwner) return { ok: false, message: "The owner can't be removed." };
  await db.delete(users).where(eq(users.id, id));
  revalidatePath(PATH);
  return { ok: true, message: "Team member removed." };
}

export async function resendTeamInvite(id: string): Promise<Result> {
  await requireOwnerSession();
  if (!db) return { ok: false, message: "Database not configured." };
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target || target.role !== "admin") return { ok: false, message: "Not a team member." };
  if (target.isOwner) return { ok: false, message: "The owner doesn't need an invite." };
  const temp = tempPassword();
  await db.update(users).set({ passwordHash: await bcrypt.hash(temp, 10) }).where(eq(users.id, id));
  const sent = await emailInvite(target.email, target.name ?? "", temp);
  return {
    ok: true,
    message: sent ? "A fresh invite was emailed." : `Email isn't connected — new temporary password: ${temp}`,
  };
}
