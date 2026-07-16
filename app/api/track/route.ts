import { db } from "@/db";
import { clicks, affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getDefaultDestination } from "@/lib/queries";
import { rateLimit } from "@/lib/rate-limit";

const STORE = process.env.SHOPIFY_STORE_DOMAIN
  ? `https://${process.env.SHOPIFY_STORE_DOMAIN}`
  : "https://example.com";

/**
 * Resolve a safe redirect target. `to` is attacker-controllable, so only allow
 * it when its host is the store domain or the configured default destination
 * (or a subdomain of either); otherwise fall back to a trusted default.
 */
async function safeRedirect(to: string): Promise<string> {
  const fallback = (await getDefaultDestination().catch(() => "")) || STORE;
  try {
    const u = new URL(to);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    const allow = new Set<string>();
    if (process.env.SHOPIFY_STORE_DOMAIN) allow.add(process.env.SHOPIFY_STORE_DOMAIN.toLowerCase());
    try { allow.add(new URL(fallback).hostname.toLowerCase()); } catch {}
    const host = u.hostname.toLowerCase();
    const ok = [...allow].some((a) => a && (host === a || host.endsWith("." + a)));
    return ok ? to : fallback;
  } catch {
    return fallback;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref")?.toUpperCase();
  const rawTo = url.searchParams.get("to") ?? STORE;
  const to = await safeRedirect(rawTo);

  if (ref && db) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
    // Throttle click logging so a pixel/bot can't stuff the clicks table (and
    // last-click credit) for a ref — the redirect still happens either way.
    const allowed = rateLimit(`click:${ip}:${ref}`, 12, 60_000).ok;
    const aff = allowed ? await db.query.affiliates.findFirst({ where: eq(affiliates.refCode, ref) }) : null;
    if (aff) {
      const jar = await cookies();
      const vid = jar.get("_aff_vid")?.value ?? randomUUID();
      // Not httpOnly on purpose: the storefront reads it to pass _aff_vid into
      // the Shopify order's note_attributes for last-click attribution.
      jar.set("_aff_vid", vid, { maxAge: 60 * 60 * 24 * 30, httpOnly: false, sameSite: "lax" });
      await db.insert(clicks).values({
        affiliateId: aff.id,
        visitorId: vid,
        landingUrl: to,
        ip,
        userAgent: req.headers.get("user-agent") ?? "",
      });
    }
  }

  return Response.redirect(to, 302);
}
