"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { posts, affiliates } from "@/db/schema";
import { auth } from "@/lib/auth";
import { notify } from "@/lib/notifications";

type Result = { ok: boolean; message: string };

async function myAffiliateId(): Promise<string | null> {
  const session = await auth();
  return ((session?.user as any)?.affiliateId as string | undefined) ?? null;
}
async function assertAdmin() {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") throw new Error("Unauthorized");
}

// ---------- Post tracking ----------

export async function submitPost(input: unknown): Promise<Result> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      url: z.string().url("Paste a valid link to your post."),
      platform: z.enum(["instagram", "tiktok", "youtube", "x", "facebook", "other"]).default("instagram"),
      note: z.string().max(280).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid post." };
  const d = parsed.data;
  await db.insert(posts).values({ affiliateId, url: d.url, platform: d.platform, note: d.note || null });
  revalidatePath("/posts");
  revalidatePath("/admin/content");
  return { ok: true, message: "Post logged — nice work! 📣" };
}

export async function deletePost(id: string): Promise<Result> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId || !db) return { ok: false, message: "Not signed in." };
  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.affiliateId, affiliateId)));
  revalidatePath("/posts");
  return { ok: true, message: "Post removed." };
}

/** Admin nudge to an affiliate who's gone quiet. */
export async function nudgeAffiliate(affiliateId: string): Promise<Result> {
  await assertAdmin();
  if (!db) return { ok: false, message: "Database not configured." };
  await notify(affiliateId, "dashboard", "We'd love to see you post! 📣", "Share your link or code today — new content drives new sales (and commissions for you).", "/links");
  return { ok: true, message: "Nudge sent." };
}

// ---------- Link-in-bio profile ----------

export async function updatePublicProfile(input: unknown): Promise<Result> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      handle: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/i, "Letters, numbers, and hyphens only."),
      bio: z.string().max(240).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid handle." };
  const handle = parsed.data.handle.toLowerCase();
  const clash = await db.query.affiliates.findFirst({ where: and(eq(affiliates.handle, handle), ne(affiliates.id, affiliateId)) });
  if (clash) return { ok: false, message: "That handle is taken — try another." };
  await db.update(affiliates).set({ handle, bio: parsed.data.bio || null }).where(eq(affiliates.id, affiliateId));
  revalidatePath("/settings");
  revalidatePath(`/p/${handle}`);
  return { ok: true, message: "Your public page is updated." };
}
