# Connecting Affilaite to Shopify

Because this runs on **your own store**, use a **custom app** — no OAuth marketplace
flow needed.

## 1. Create the custom app

1. Shopify admin → **Settings → Apps and sales channels → Develop apps**.
2. **Create an app** → name it "Affilaite".
3. **Configure Admin API scopes** — enable at minimum:
   - `read_orders`, `write_discounts`, `read_discounts`
   - `read_customers` (for new-customer detection)
4. **Install app**, then reveal:
   - **Admin API access token** → `SHOPIFY_ADMIN_TOKEN` (starts with `shpat_`)
   - **API secret key** → `SHOPIFY_API_SECRET` (used to verify webhook HMAC)
5. Your store domain (e.g. `your-store.myshopify.com`) → `SHOPIFY_STORE_DOMAIN`.

## 2. Register the webhooks

Once the app is deployed and `APP_URL` is set, run:

```bash
npm run shopify:webhooks
```

This registers `orders/create`, `orders/updated`, and `refunds/create` pointing at
`https://<APP_URL>/api/webhooks/shopify`. Verify them under
**Settings → Notifications → Webhooks**.

> Every webhook is HMAC-verified against `SHOPIFY_API_SECRET` — invalid signatures are rejected.

## 3. Coupon attribution — works immediately

Coupon attribution needs **no theme changes**. Generate a code per affiliate
(Admin → Discount Codes), and any order using that code is attributed automatically.

## 4. (Optional) Link attribution — one theme snippet

To also attribute link clicks (the cookie backup), copy the `_aff_vid` cookie into a
checkout note attribute so it arrives in `orders/create`. Add to your theme (e.g. a
cart script or checkout UI extension):

```js
// Copies the affiliate visitor id into a cart note attribute
function getCookie(n) {
  return document.cookie.split("; ").find((c) => c.startsWith(n + "="))?.split("=")[1];
}
const vid = getCookie("_aff_vid");
if (vid) {
  fetch("/cart/update.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attributes: { _aff_vid: vid } }),
  });
}
```

That's it — coupon-first attribution is live, with link tracking as a backup.
