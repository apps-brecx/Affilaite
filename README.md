<div align="center">

# Affilaite

**A premium affiliate & referral platform for modern Shopify brands.**

Coupon-first attribution · native PayPal payouts · a portal your partners will love.

</div>

---

Affilaite connects to your Shopify store, tracks every sale, calculates commissions,
reverses them automatically on refund, and pays affiliates in one native PayPal batch —
wrapped in a clean, fast, private-bank-grade interface.

## ✨ What's inside

**Affiliate portal** (`/dashboard`, `/links`, `/performance`, `/payouts`, `/assets`, `/settings`)
- Earnings dashboard with live count-ups, an emerald earnings chart, and a "next payout" banner
- A hero **Links & Codes** page: gilded discount code, trackable referral link, real QR, deep-link builder
- Performance analytics — clicks, orders, conversion funnel, EPC, top products
- PayPal payout balance, threshold progress, and full history

**Admin** (`/admin` + sub-pages)
- **Command Center** — revenue, active affiliates, pending commissions, refund rate, leaderboard, approval queue
- **Affiliates** — searchable/filterable roster with bulk approve and detail pages
- **Programs** — commission rulesets (percent/flat, cookie window, hold days, minimums)
- **Commissions** — the ledger: filter, bulk approve, reverse, CSV export
- **Payouts** — build the payable batch and run a native PayPal payout (sandbox-first)
- ⭐ **Bulk discount generator** — mint a trackable Shopify code for every affiliate with a live progress UI
- **Groups**, **Messages** (broadcast composer with template variables), **Promotions**, **Settings**

**Public** — a prestige marketing landing (`/`) and an affiliate application flow (`/apply`).

## 🎨 Design system — "Obsidian & Gold"

- **Type:** Fraunces (editorial display serif) · Inter (UI) · JetBrains Mono (figures)
- **Color:** warm ivory & deep emerald in light, obsidian & gilded highlights in dark — **dark mode from day one**
- Tabular figures everywhere money appears · soft cards & hairline borders · sub-200ms motion via Framer Motion
- Charts follow accessible dataviz rules (single-hue areas, CVD-safe categorical leaderboard palette)

## 🧱 Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Database | Neon Postgres via Drizzle ORM |
| Auth | Auth.js v5 (role-based: admin + affiliate) |
| Styling | Tailwind + custom design system + Framer Motion + lucide-react |
| Charts | Recharts |
| Email | Resend |
| Payouts | PayPal Payouts API |
| Store | Shopify Admin GraphQL + Webhooks |
| Hosting | Render (web + cron) |

## 🚀 Getting started

```bash
npm install
cp .env.example .env      # fill in what you have — or leave DATABASE_URL blank
npm run dev               # http://localhost:3000
```

> **Zero-config preview:** with no `DATABASE_URL`, the entire app runs on a rich,
> deterministic demo dataset so every page renders immediately. Add a database to go live.

### Going live with a database

```bash
# 1. Create a Neon project, copy the POOLED connection string into DATABASE_URL
# 2. Push the schema and seed a starter program + affiliates
npm run db:push
DATABASE_URL=... npm run db:seed
```

The data layer lives in [`lib/queries.ts`](lib/queries.ts) — each function is the seam
where a Drizzle query replaces the demo source, returning identical shapes.

## 🧠 How attribution works

Coupon-first, link-second, last-click (see [`lib/attribution.ts`](lib/attribution.ts)):

1. Read `order.discount_codes[]` → match a code to an affiliate (**source of truth**)
2. Fall back to the `_aff_vid` cookie → most recent click within the program's window
3. Block self-referrals, apply the hold period, record a `pending` commission
4. On `refunds/create`, the commission reverses automatically

Every external call is **idempotent** (`shopifyOrderId` unique, `sender_batch_id` unique,
webhook dedupe table) so retries never double-pay or double-count.

## 🔌 Integrations

| File | Responsibility |
|---|---|
| `app/api/webhooks/shopify/route.ts` | HMAC-verified `orders/create` · `refunds/create` |
| `app/api/track/route.ts` | Click logger → first-party cookie → 302 to store |
| `app/api/webhooks/paypal/route.ts` | Payout item status reconciliation |
| `app/api/cron/route.ts` | Daily commission maturation (secured by `CRON_SECRET`) |
| `lib/shopify.ts` · `lib/paypal.ts` · `lib/discounts.ts` · `lib/email.ts` | Typed clients |

## ☁️ Deploy (Render + Neon)

1. **Neon** — create a project, copy the pooled `DATABASE_URL`.
2. **Render** — connect the repo; [`render.yaml`](render.yaml) provisions the web service
   and the daily commission-approval cron. Add the env vars from `.env.example`.
3. **Shopify** — register `orders/create`, `orders/updated`, `refunds/create` webhooks pointing
   at `/api/webhooks/shopify`.
4. **PayPal** — start in sandbox, verify a full payout, then flip `PAYPAL_BASE` to live.

---

<div align="center"><sub>Built for brands that treat affiliates like a business — not an afterthought.</sub></div>
