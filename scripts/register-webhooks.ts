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
  // Shopify credentials may come from env or from the Settings → Integrations UI
  // (stored in the DB). registerWebhooks throws a clear error if not connected.

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
