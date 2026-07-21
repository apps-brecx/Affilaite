import { approveMaturedCommissions } from "@/lib/commissions";
import { reconcileProcessingPayouts, maybeAutoPayout, runScheduledPayout } from "@/lib/payouts";
import { scanAllAffiliates } from "@/lib/social-scan";
import { paypalReady, shopifyReady } from "@/lib/integrations";
import { getStoreProducts, getStoreCollections } from "@/lib/products";

// Render Cron hits this daily to mature commissions past their hold window and
// reconcile any payouts still processing. Protect with a shared secret so only
// your scheduler can trigger it.
export async function GET(req: Request) {
  // Fail closed: a missing secret must NOT leave the endpoint open (it can
  // approve commissions), so require it to be configured and to match.
  if (!process.env.CRON_SECRET) {
    return new Response("cron secret not configured", { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const result = await approveMaturedCommissions();
  // In automatic mode, pay out the freshly-matured commissions.
  const autoPaid = await maybeAutoPayout().catch(() => "");
  // Scheduled payout run (weekly/monthly), respecting each affiliate's minimum.
  const scheduled = await runScheduledPayout().catch(() => "");
  // Roll any still-"processing" payout batches forward from PayPal's state.
  if (await paypalReady()) await reconcileProcessingPayouts().catch(() => {});
  // Warm the persistent catalog cache so no affiliate/admin page ever has to
  // wait on the full (throttled) Shopify product fetch — it's already in the DB.
  if (await shopifyReady()) {
    await Promise.all([
      getStoreProducts(1000).catch(() => {}),
      getStoreCollections(250).catch(() => {}),
    ]);
  }
  // Daily AI worker: scan affiliates' public socials for new brand content.
  const scan = await scanAllAffiliates().catch((e) => {
    console.error("[cron] social scan:", e);
    return null;
  });
  return Response.json({ ok: true, ...result, autoPaid: autoPaid || null, scheduled: scheduled || null, scan });
}
