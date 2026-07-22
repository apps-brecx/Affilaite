import { db } from "@/db";
import { clicks, affiliates, discountCodes } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { getDefaultDestination } from "@/lib/queries";
import { shopifyConfig } from "@/lib/integrations";
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
    // Also trust the store domain configured through the Settings UI (stored in
    // the DB, not env) — otherwise every real product link is rejected to the
    // fallback when Shopify was connected that way.
    try {
      const { domain } = await shopifyConfig();
      if (domain) allow.add(domain.toLowerCase());
    } catch {}
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

  // A stable visitor id, reused across clicks so last-click attribution works.
  const jar = await cookies();
  const vid = jar.get("_aff_vid")?.value ?? randomUUID();

  // The affiliate's discount code, auto-applied at the store so the customer
  // never has to type it (and coupon attribution — the most reliable path —
  // credits the affiliate even if the ref params are dropped downstream).
  let autoCode: string | null = null;

  if (ref && db) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || "unknown";
    // Throttle click logging so a pixel/bot can't stuff the clicks table (and
    // last-click credit) for a ref — the redirect still happens either way.
    const allowed = rateLimit(`click:${ip}:${ref}`, 12, 60_000).ok;
    const aff = allowed ? await db.query.affiliates.findFirst({ where: eq(affiliates.refCode, ref) }) : null;
    if (aff) {
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
      const dc = await db.query.discountCodes.findFirst({
        where: and(eq(discountCodes.affiliateId, aff.id), eq(discountCodes.active, true)),
      });
      autoCode = dc?.code ?? null;
    }
  }

  // Forward the referral onto the store URL: the storefront snippet
  // (docs/STOREFRONT_TRACKING.md) reads ref + aff_vid and attaches them to the
  // cart so they arrive on the order as note attributes — this is what makes
  // link attribution work across the app-domain → store-domain boundary. The
  // utm_* tags also make Shopify's own Conversion details show the affiliate.
  const dest = new URL(to);
  if (ref) {
    dest.searchParams.set("ref", ref);
    dest.searchParams.set("aff_vid", vid);
    dest.searchParams.set("utm_source", "sipfluence");
    dest.searchParams.set("utm_medium", "affiliate");
    dest.searchParams.set("utm_campaign", ref);
  }

  // Auto-apply the affiliate's code: Shopify's /discount/{CODE}?redirect=<path>
  // link drops the code into the customer's cart and then forwards them to the
  // page they were headed to — so the discount is already in before they type a
  // thing. Only when the destination is the Shopify storefront itself.
  if (autoCode && (await isShopifyStore(dest.hostname))) {
    const discountUrl = new URL(`/discount/${encodeURIComponent(autoCode)}`, dest.origin);
    // Shopify redirects here after applying the code; keep the ref/utm query so
    // link attribution and analytics still see the affiliate.
    discountUrl.searchParams.set("redirect", `${dest.pathname}${dest.search}`);
    return Response.redirect(discountUrl.toString(), 302);
  }

  return Response.redirect(dest.toString(), 302);
}

/**
 * True when the host is the Shopify storefront — the connected myshopify domain,
 * or the store's primary/custom domain (the default destination). /discount links
 * work on either. Both are already the trusted hosts safeRedirect() allows.
 */
async function isShopifyStore(host: string): Promise<boolean> {
  const h = host.toLowerCase();
  const domains = new Set<string>();
  if (process.env.SHOPIFY_STORE_DOMAIN) domains.add(process.env.SHOPIFY_STORE_DOMAIN.toLowerCase());
  try {
    const { domain } = await shopifyConfig();
    if (domain) domains.add(domain.toLowerCase());
  } catch {}
  try {
    const def = await getDefaultDestination();
    if (def) domains.add(new URL(def).hostname.toLowerCase());
  } catch {}
  return [...domains].some((d) => d && (h === d || h.endsWith("." + d)));
}
