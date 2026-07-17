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
   https://syruvia.com/?ref=DAVID&aff_vid=<uuid>&utm_source=sipfluence&…
        │
        ▼  the snippet below (running on syruvia.com) stores ref + aff_vid
           in a first-party cookie and attaches them to the cart
        │
        ▼  customer checks out → order arrives with note_attributes:
           [{ name: "_aff_ref", value: "DAVID" }, { name: "_aff_vid", value: "<uuid>" }]
        │
        ▼  orders/create (paid) webhook → processOrderCreated → commission for DAVID ✅
           and the order is tagged in Shopify: affiliate:DAVID, source:sipfluence
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

## Prerequisites

1. **Webhooks registered.** Shopify must send `orders/create` (and ideally
   `orders/paid`) to `https://<app>/api/webhooks/shopify`. Zero webhooks = nothing
   attributes, coupon or link.
2. **Shopify connected** in **Settings → Integrations** with the Admin API token
   **and** the API secret key (verifies webhook signatures).
3. **Order tagging** needs the `write_orders` scope on the Admin API token. Without
   it, attribution still works — only the Shopify-side tags are skipped.

## Why an order might NOT attribute (now visible in the admin)

Every incoming order records its outcome, shown in **Admin → Recent attributed
orders**:

| What you see | Meaning |
|---|---|
| `attributed → DAVID15` | ✅ commission created (order tagged in Shopify too) |
| `self-referral blocked …` | buyer email equals the affiliate's own account email |
| `skipped — DAVID is pending, not approved` | approve the affiliate first |
| `no affiliate code or link` | order used no affiliate coupon and no tracking link |
| `coupon not linked to an affiliate` | the code isn't tied to an affiliate in the app |
| `skipped — returning customer …` | program/campaign is new-customers-only |
| `skipped — order below campaign minimum …` | campaign min-order rule |
| `waiting for payment` | order isn't paid yet (waits for `orders/paid`) |

> **Testing with your own email?** Set the env var `ALLOW_SELF_REFERRAL=true` in
> Render to let your own purchases earn commission. **Turn it back off** before
> going live, or affiliates can pay themselves.
