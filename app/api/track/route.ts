import { db } from "@/db";
import { clicks, affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "";
const STORE = STORE_DOMAIN ? `https://${STORE_DOMAIN}` : "https://example.com";

/**
 * Only allow redirects to the store itself — never to an arbitrary host.
 * Prevents `?to=https://evil.com` turning a trusted referral link into an open redirect.
 */
function safeDestination(raw: string | null): URL {
  if (!raw) return new URL(STORE);
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return new URL(STORE);
    if (STORE_DOMAIN && (u.hostname === STORE_DOMAIN || u.hostname.endsWith(`.${STORE_DOMAIN}`))) {
      return u;
    }
    return new URL(STORE);
  } catch {
    return new URL(STORE);
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref")?.toUpperCase();
  const dest = safeDestination(url.searchParams.get("to"));

  // A stable visitor id, reused across clicks so last-click attribution works.
  const jar = await cookies();
  const vid = jar.get("_aff_vid")?.value ?? randomUUID();

  if (ref && db) {
    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.refCode, ref) });
    if (aff) {
      jar.set("_aff_vid", vid, { maxAge: 60 * 60 * 24 * 30, httpOnly: true, sameSite: "lax" });
      await db.insert(clicks).values({
        affiliateId: aff.id,
        visitorId: vid,
        landingUrl: dest.toString(),
        ip: req.headers.get("x-forwarded-for") ?? "",
        userAgent: req.headers.get("user-agent") ?? "",
      });
    }
  }

  // Carry the referral onto the store URL. The storefront snippet
  // (docs/STOREFRONT_TRACKING.md) reads these and attaches them to the cart so
  // they arrive on the order as note attributes — this is what makes link
  // attribution work across the app domain → store domain boundary.
  if (ref) {
    dest.searchParams.set("ref", ref);
    dest.searchParams.set("aff_vid", vid);
  }

  return Response.redirect(dest.toString(), 302);
}
