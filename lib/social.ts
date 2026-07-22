// lib/social.ts — post tracking + public link-in-bio profile data.
import { db } from "@/db";
import { posts, affiliates, users, discountCodes, discoveredPosts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface PostRow {
  id: string;
  url: string;
  platform: string;
  note: string | null;
  createdAt: string;
  affiliateId: string;
  affiliateName?: string;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : new Date().toISOString());

export async function listMyPosts(affiliateId: string): Promise<PostRow[]> {
  if (!db) return [];
  const rows = await db.select().from(posts).where(eq(posts.affiliateId, affiliateId)).orderBy(desc(posts.createdAt)).limit(100);
  return rows.map((p) => ({ id: p.id, url: p.url, platform: p.platform, note: p.note ?? null, createdAt: iso(p.createdAt), affiliateId: p.affiliateId }));
}

export async function listRecentPosts(limit = 60): Promise<PostRow[]> {
  if (!db) return [];
  const rows = await db
    .select({ p: posts, name: users.name, email: users.email })
    .from(posts)
    .leftJoin(affiliates, eq(posts.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .orderBy(desc(posts.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.p.id,
    url: r.p.url,
    platform: r.p.platform,
    note: r.p.note ?? null,
    createdAt: iso(r.p.createdAt),
    affiliateId: r.p.affiliateId,
    affiliateName: r.name ?? r.email ?? "Partner",
  }));
}

/** Approved affiliates who haven't posted in `days` (or ever) — the "gone quiet" list. */
export async function quietAffiliates(days = 14): Promise<{ affiliateId: string; name: string; lastPostAt: string | null }[]> {
  if (!db) return [];
  const rows = await db
    .select({
      affiliateId: affiliates.id,
      name: users.name,
      email: users.email,
      lastPost: sql<string | null>`max(${posts.createdAt})`,
    })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .leftJoin(posts, eq(posts.affiliateId, affiliates.id))
    .where(eq(affiliates.status, "approved"))
    .groupBy(affiliates.id, users.name, users.email);
  const cutoff = Date.now() - days * 86_400_000;
  return rows
    .filter((r) => !r.lastPost || new Date(r.lastPost).getTime() < cutoff)
    .map((r) => ({ affiliateId: r.affiliateId, name: r.name ?? r.email ?? "Partner", lastPostAt: r.lastPost ? new Date(r.lastPost).toISOString() : null }))
    .sort((a, b) => (a.lastPostAt ?? "").localeCompare(b.lastPostAt ?? ""));
}

export interface DiscoveredRow {
  id: string;
  affiliateId: string;
  affiliateName: string;
  platform: string;
  url: string;
  thumbnailUrl: string | null;
  mediaType: string;
  caption: string | null;
  description: string | null;
  postedAt: string | null;
  status: string;
}

/** Auto-discovered brand content (from the daily AI scan) for the admin feed. */
export async function listDiscoveredPosts(limit = 60): Promise<DiscoveredRow[]> {
  if (!db) return [];
  const rows = await db
    .select({ d: discoveredPosts, name: users.name, email: users.email })
    .from(discoveredPosts)
    .leftJoin(affiliates, eq(discoveredPosts.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(and(eq(discoveredPosts.status, "new")))
    .orderBy(desc(discoveredPosts.postedAt), desc(discoveredPosts.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.d.id,
    affiliateId: r.d.affiliateId,
    affiliateName: r.name ?? r.email ?? "Partner",
    platform: r.d.platform,
    url: r.d.url,
    thumbnailUrl: r.d.thumbnailUrl,
    mediaType: r.d.mediaType,
    caption: r.d.caption,
    description: r.d.description,
    postedAt: r.d.postedAt ? new Date(r.d.postedAt).toISOString() : null,
    status: r.d.status,
  }));
}

export interface PublicProfile {
  id: string;
  name: string;
  handle: string;
  bio: string | null;
  code: string;
  refCode: string;
  socials: Record<string, string>;
  favoriteCollectionHandle: string | null;
}

export async function getPublicProfile(handle: string): Promise<PublicProfile | null> {
  if (!db) return null;
  const rows = await db
    .select({ aff: affiliates, name: users.name })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(affiliates.handle, handle.toLowerCase()))
    .limit(1);
  const row = rows[0];
  if (!row || row.aff.status !== "approved") return null;
  const code = await db.query.discountCodes.findFirst({ where: eq(discountCodes.affiliateId, row.aff.id) });
  return {
    id: row.aff.id,
    name: row.name ?? "Partner",
    handle: row.aff.handle!,
    bio: row.aff.bio ?? null,
    code: code?.code ?? row.aff.refCode,
    refCode: row.aff.refCode,
    socials: (row.aff.socialLinks as Record<string, string>) ?? {},
    favoriteCollectionHandle: row.aff.favoriteCollectionHandle ?? null,
  };
}
