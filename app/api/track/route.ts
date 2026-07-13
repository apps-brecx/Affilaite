import { db } from "@/db";
import { clicks, affiliates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";

const STORE = process.env.SHOPIFY_STORE_DOMAIN
  ? `https://${process.env.SHOPIFY_STORE_DOMAIN}`
  : "https://example.com";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ref = url.searchParams.get("ref")?.toUpperCase();
  const to = url.searchParams.get("to") ?? STORE;

  if (ref && db) {
    const aff = await db.query.affiliates.findFirst({ where: eq(affiliates.refCode, ref) });
    if (aff) {
      const jar = await cookies();
      const vid = jar.get("_aff_vid")?.value ?? randomUUID();
      jar.set("_aff_vid", vid, { maxAge: 60 * 60 * 24 * 30, httpOnly: false, sameSite: "lax" });
      await db.insert(clicks).values({
        affiliateId: aff.id,
        visitorId: vid,
        landingUrl: to,
        ip: req.headers.get("x-forwarded-for") ?? "",
        userAgent: req.headers.get("user-agent") ?? "",
      });
    }
  }

  return Response.redirect(to, 302);
}
