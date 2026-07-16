# Storefront tracking snippet — makes referral **links** attribute sales

Coupon codes attribute on their own (Shopify puts the code on the order). **Links**
need one extra piece, because the click happens on the app domain
(`sipfluence.brecx.com`) while checkout happens on the store domain
(`syruvia.com`) — and browsers don't share cookies across domains.

This snippet runs on the store, catches the referral that `/api/track` forwards in
the URL, and attaches it to the cart. It then arrives on the order as
`note_attributes`, which `lib/attribution.ts` reads.

## How the flow works

```
Customer clicks  https://sipfluence.brecx.com/api/track?ref=DAVID&to=https://syruvia.com
        │
        ▼  /api/track logs the click, then 302-redirects to:
   https://syruvia.com/?ref=DAVID&aff_vid=<uuid>
        │
        ▼  the snippet below (running on syruvia.com) stores ref + aff_vid
           in a first-party cookie and attaches them to the cart
        │
        ▼  customer checks out → order arrives with note_attributes:
           [{ name: "_aff_ref", value: "DAVID" }, { name: "_aff_vid", value: "<uuid>" }]
        │
        ▼  orders/create webhook → processOrderCreated → commission for DAVID ✅
```

## Install (Online Store theme)

Shopify admin → **Online Store → Themes → ⋯ → Edit code** → open `layout/theme.liquid`,
and paste this just before the closing `</body>` tag:

```html
<script>
  (function () {
    var DAY30 = 60 * 60 * 24 * 30;
    var p = new URLSearchParams(location.search);

    function setCookie(k, v) {
      if (!v) return;
      document.cookie = k + "=" + encodeURIComponent(v) + ";path=/;max-age=" + DAY30 + ";samesite=lax";
    }
    function getCookie(k) {
      var m = document.cookie.match("(^|;)\\s*" + k + "\\s*=\\s*([^;]+)");
      return m ? decodeURIComponent(m.pop()) : "";
    }

    // 1. Capture the referral the moment the customer lands from a tracking link.
    if (p.get("ref")) setCookie("_aff_ref", p.get("ref"));
    if (p.get("aff_vid")) setCookie("_aff_vid", p.get("aff_vid"));

    // 2. On every page, make sure the current cart carries the attribution.
    var ref = getCookie("_aff_ref");
    var vid = getCookie("_aff_vid");
    if (ref || vid) {
      var attributes = {};
      if (ref) attributes["_aff_ref"] = ref;
      if (vid) attributes["_aff_vid"] = vid;
      fetch("/cart/update.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributes: attributes }),
      }).catch(function () {});
    }
  })();
</script>
```

That's it. No theme changes are needed for coupon codes — this only affects links.

## Verify it works

1. Open `https://<app>/api/track?ref=DAVID&to=https://syruvia.com` in a fresh
   browser (not signed in as the affiliate — self-referrals are blocked by email).
2. You should land on the store with `?ref=DAVID&aff_vid=...` in the URL.
3. Add to cart and check out. Open the order in Shopify admin → **Additional details**
   should show `_aff_ref = DAVID`.
4. The commission appears on DAVID's dashboard once the `orders/create` webhook is
   registered (see below).

## Prerequisite: register the webhooks

None of this works — **coupon or link** — until Shopify is actually sending orders
to the app. Your store currently has **zero** webhooks registered, which is why
nothing shows up yet.

1. In the app: **Settings → Integrations**, connect Shopify with the Admin API
   access token **and** the app's **API secret key** (the secret key is what signs
   webhooks; the app checks it in `verifyShopifyHmac`).
2. Register the webhooks with your own app's credentials:

   ```bash
   APP_URL=https://sipfluence.brecx.com \
   SHOPIFY_STORE_DOMAIN=syruvia.com \
   SHOPIFY_ADMIN_TOKEN=shpat_... \
   npm run shopify:webhooks
   ```

3. Confirm under Shopify admin → **Settings → Notifications → Webhooks**, or place a
   test order with a coupon and watch the commission land.

> Do **not** register the webhooks from any other app's API session — Shopify signs
> each webhook with the creating app's secret, and the app only trusts webhooks
> signed with *your* API secret key.
