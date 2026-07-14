// scripts/register-webhooks.ts — one-command Shopify webhook setup.
// Registers orders/create, orders/updated, refunds/create pointing at your app.
//
// Run with:  APP_URL=https://your-app.onrender.com \
//            SHOPIFY_STORE_DOMAIN=... SHOPIFY_ADMIN_TOKEN=... \
//            npm run shopify:webhooks
import { registerWebhooks } from "../lib/shopify";

async function main() {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    console.error("APP_URL is required (e.g. https://your-app.onrender.com).");
    process.exit(1);
  }
  if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ADMIN_TOKEN) {
    console.error("SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN are required.");
    process.exit(1);
  }

  const callbackUrl = `${appUrl.replace(/\/$/, "")}/api/webhooks/shopify`;
  console.log("Registering Shopify webhooks →", callbackUrl);

  const results = await registerWebhooks(callbackUrl);
  for (const r of results as any[]) {
    const errs = r?.data?.webhookSubscriptionCreate?.userErrors ?? [];
    if (errs.length) console.warn("  ⚠", errs.map((e: any) => e.message).join(", "));
    else console.log("  ✓ subscription created");
  }
  console.log("Done. Verify under Shopify admin → Settings → Notifications → Webhooks.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
