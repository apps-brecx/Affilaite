// lib/social-scan.ts — the daily "AI worker" that scans affiliates' public
// social accounts for content they've posted about the brand.
//
// Reality check on what's actually fetchable without each creator connecting
// their account:
//   • YouTube  — public per-channel RSS feed. Fully implemented here, no key.
//   • Instagram / TikTok / X / Facebook — these platforms block unauthenticated
//     scraping, so they go through an optional third-party provider seam
//     (SOCIAL_SCRAPE_ENDPOINT + SOCIAL_SCRAPE_API_KEY, e.g. an Apify actor).
//     With no provider configured those platforms are skipped gracefully.
//
// Every discovered item is filtered for brand relevance, de-duplicated against
// what we've already stored, given a short AI description, and saved to
// `discovered_posts` for the admin Content feed.

import { db } from "@/db";
import { affiliates, users, discountCodes, discoveredPosts } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { describeContent } from "@/lib/ai";

const BRAND_TERMS = ["syruvia", "sipfluence"];

export interface ScanResult {
  scannedAffiliates: number;
  discovered: number;
  byPlatform: Record<string, number>;
  skipped: string[]; // platforms skipped for lack of a scraper provider
}

interface Candidate {
  externalId: string;
  url: string;
  thumbnailUrl: string | null;
  mediaType: "video" | "image" | "post";
  caption: string;
  postedAt: Date | null;
}

// ---------- YouTube (real, no API key) ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

async function resolveYoutubeChannelId(url: string): Promise<string | null> {
  const direct = url.match(/\/channel\/(UC[\w-]{20,})/);
  if (direct) return direct[1];
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SipfluenceBot/1.0)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/"channelId":"(UC[\w-]{20,})"/) || html.match(/channel_id=(UC[\w-]{20,})/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function fetchYoutube(url: string): Promise<Candidate[]> {
  const channelId = await resolveYoutubeChannelId(url);
  if (!channelId) return [];
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);
    const out: Candidate[] = [];
    for (const e of entries.slice(0, 15)) {
      const videoId = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1];
      if (!videoId) continue;
      const title = decodeEntities(e.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
      const desc = decodeEntities(e.match(/<media:description>([\s\S]*?)<\/media:description>/)?.[1] ?? "");
      const published = e.match(/<published>([^<]+)<\/published>/)?.[1];
      const thumb = e.match(/<media:thumbnail url="([^"]+)"/)?.[1] ?? null;
      out.push({
        externalId: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl: thumb,
        mediaType: "video",
        caption: [title, desc].filter(Boolean).join(" — "),
        postedAt: published ? new Date(published) : null,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------- Provider seam for platforms that block scraping ----------

async function fetchViaProvider(platform: string, url: string): Promise<Candidate[] | null> {
  const endpoint = process.env.SOCIAL_SCRAPE_ENDPOINT;
  const key = process.env.SOCIAL_SCRAPE_API_KEY;
  if (!endpoint || !key) return null; // not configured → caller records a skip
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ platform, url }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const items: any[] = Array.isArray(json) ? json : json?.items ?? [];
    return items
      .filter((it) => it?.id && it?.url)
      .slice(0, 15)
      .map((it) => ({
        externalId: String(it.id),
        url: String(it.url),
        thumbnailUrl: it.thumbnail ?? it.thumbnailUrl ?? null,
        mediaType: (["video", "image", "post"].includes(it.mediaType) ? it.mediaType : "post") as Candidate["mediaType"],
        caption: String(it.caption ?? it.title ?? ""),
        postedAt: it.postedAt ? new Date(it.postedAt) : null,
      }));
  } catch {
    return [];
  }
}

function normalizePlatform(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("insta")) return "instagram";
  if (k.includes("tiktok")) return "tiktok";
  if (k.includes("youtube") || k === "yt") return "youtube";
  if (k === "x" || k.includes("twitter")) return "x";
  if (k.includes("facebook") || k === "fb") return "facebook";
  return "other";
}

// Social-media platform keys we actually scan (everything else on the profile,
// like `website` or the link-in-bio `handle`, is ignored).
const SCANNABLE = new Set(["instagram", "tiktok", "youtube", "x", "facebook"]);

const PROFILE_BASE: Record<string, string> = {
  instagram: "https://www.instagram.com/",
  tiktok: "https://www.tiktok.com/@",
  youtube: "https://www.youtube.com/@",
  x: "https://x.com/",
  facebook: "https://www.facebook.com/",
};

/**
 * Turn whatever the affiliate typed (a full URL, `youtube.com/@x`, `@handle`,
 * or a bare username) into a fetchable profile URL for the given platform.
 * Returns null if there's nothing usable.
 */
function toProfileUrl(platform: string, raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+\.[\w.-]+\//.test(v) || /\.(com|tv|me|co)\b/i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  const handle = v.replace(/^@+/, "");
  const base = PROFILE_BASE[platform];
  return base ? `${base}${handle}` : null;
}

function isBrandRelevant(caption: string, extraTerms: string[]): boolean {
  const c = caption.toLowerCase();
  if (!c) return false;
  return [...BRAND_TERMS, ...extraTerms].some((t) => t && c.includes(t));
}

/**
 * Scan every approved affiliate's public social accounts for brand content.
 * Idempotent: already-discovered items are skipped, so it's safe to run daily
 * (via /api/cron) or on demand from the admin Content page.
 */
export async function scanAllAffiliates(): Promise<ScanResult> {
  const result: ScanResult = { scannedAffiliates: 0, discovered: 0, byPlatform: {}, skipped: [] };
  if (!db) return result;

  const rows = await db
    .select({ id: affiliates.id, refCode: affiliates.refCode, links: affiliates.socialLinks, name: users.name })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(affiliates.status, "approved"));

  const skippedPlatforms = new Set<string>();

  for (const aff of rows) {
    const links = (aff.links ?? {}) as Record<string, string>;
    // Map each social entry to {platform, url}, ignoring non-social keys
    // (website, handle) and turning handles into fetchable profile URLs.
    const entries = Object.entries(links)
      .map(([key, val]) => ({ platform: normalizePlatform(key), url: toProfileUrl(normalizePlatform(key), val ?? "") }))
      .filter((e): e is { platform: string; url: string } => SCANNABLE.has(e.platform) && !!e.url);
    if (entries.length === 0) continue;
    result.scannedAffiliates++;

    // Brand terms for this affiliate: their ref code + any discount codes.
    const codes = await db.select({ code: discountCodes.code }).from(discountCodes).where(eq(discountCodes.affiliateId, aff.id));
    const extraTerms = [aff.refCode?.toLowerCase(), ...codes.map((c) => c.code.toLowerCase())].filter(Boolean) as string[];

    for (const { platform, url } of entries) {
      let candidates: Candidate[] | null;
      if (platform === "youtube") {
        candidates = await fetchYoutube(url);
      } else {
        candidates = await fetchViaProvider(platform, url);
        if (candidates === null) {
          skippedPlatforms.add(platform);
          continue;
        }
      }

      const relevant = (candidates ?? []).filter((c) => isBrandRelevant(c.caption, extraTerms));
      if (relevant.length === 0) continue;

      // Drop anything we've already stored for this affiliate+platform.
      const existing = await db
        .select({ externalId: discoveredPosts.externalId })
        .from(discoveredPosts)
        .where(and(eq(discoveredPosts.affiliateId, aff.id), eq(discoveredPosts.platform, platform),
          inArray(discoveredPosts.externalId, relevant.map((c) => c.externalId))));
      const seen = new Set(existing.map((e) => e.externalId));
      const fresh = relevant.filter((c) => !seen.has(c.externalId));

      for (const c of fresh) {
        const description = await describeContent({ caption: c.caption, platform, mediaType: c.mediaType });
        await db
          .insert(discoveredPosts)
          .values({
            affiliateId: aff.id,
            platform,
            externalId: c.externalId,
            url: c.url,
            thumbnailUrl: c.thumbnailUrl,
            mediaType: c.mediaType,
            caption: c.caption.slice(0, 2000),
            description,
            postedAt: c.postedAt,
          })
          .onConflictDoNothing();
        result.discovered++;
        result.byPlatform[platform] = (result.byPlatform[platform] ?? 0) + 1;
      }
    }
  }

  result.skipped = [...skippedPlatforms];
  return result;
}
