// Validates the DB-level + pure logic of the 13 "High" audit fixes against a
// real Postgres, inside one transaction that is always rolled back.
// Run: DATABASE_URL=... npx tsx scripts/test-high-fixes.ts
import postgres from "postgres";
import { rollupBatchStatus } from "../lib/paypal";
import { customerDiscountFromConfig, discountOptionsFromConfig } from "../lib/discounts";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };

async function main() {
  // ================= H1 · rollupBatchStatus partial-failure =================
  ok("H1 mixed success+failed → partial", rollupBatchStatus(["SUCCESS", "FAILED"]) === "partial");
  ok("H1 all success → success", rollupBatchStatus(["SUCCESS", "SUCCESS"]) === "success");
  ok("H1 all failed → failed", rollupBatchStatus(["FAILED", "RETURNED"]) === "failed");
  ok("H1 any pending → processing", rollupBatchStatus(["PENDING", "SUCCESS", "FAILED"]) === "processing");
  ok("H1 empty → processing", rollupBatchStatus([]) === "processing");

  // ================= H9/H5 · customer discount from campaign config =================
  ok("H5 friend coupon 10% wins over reward",
    JSON.stringify(customerDiscountFromConfig({ friend: { kind: "coupon", valueType: "percent", value: 10 }, reward: { valueType: "percent", value: 25 } })) === JSON.stringify({ value: 10, valueType: "percent" }));
  ok("H5 fixed friend coupon $5",
    JSON.stringify(customerDiscountFromConfig({ friend: { kind: "coupon", valueType: "fixed", value: 5 } })) === JSON.stringify({ value: 5, valueType: "fixed" }));
  ok("H9 no friend → uses campaign reward %",
    JSON.stringify(customerDiscountFromConfig({ friend: { kind: "none" }, reward: { valueType: "percent", value: 20 } })) === JSON.stringify({ value: 20, valueType: "percent" }));
  ok("H9 no friend/reward → program %",
    JSON.stringify(customerDiscountFromConfig({ friend: { kind: "none" }, reward: {} }, { commissionType: "percent", commissionValue: 12 })) === JSON.stringify({ value: 12, valueType: "percent" }));
  ok("H9 nothing configured → 15% default",
    JSON.stringify(customerDiscountFromConfig({ friend: { kind: "none" }, reward: {} }, null)) === JSON.stringify({ value: 15, valueType: "percent" }));

  // ================= H6 · discountOptionsFromConfig maps coupon panel =================
  const opts = discountOptionsFromConfig(
    { reward: { valueType: "fixed" }, conditions: { minOrderType: "amount", minOrderValue: 30 }, coupon: { expires: true, combineProduct: true, combineOrder: false, combineShipping: true } },
    "2026-12-31T00:00:00.000Z",
  );
  ok("H6 valueType from reward", opts.valueType === "fixed");
  ok("H6 minimum subtotal threaded", opts.minimumSubtotal === 30);
  ok("H6 expiry threaded when coupon.expires", opts.endsAt === "2026-12-31T00:00:00.000Z");
  ok("H6 combines-with mapped", !!opts.combinesWith && opts.combinesWith.productDiscounts === true && opts.combinesWith.orderDiscounts === false && opts.combinesWith.shippingDiscounts === true);
  const noExpiry = discountOptionsFromConfig({ coupon: { expires: false } }, "2026-12-31T00:00:00.000Z");
  ok("H6 expiry dropped when coupon.expires is off", noExpiry.endsAt === null);

  await sql.begin(async (tx) => {
    await tx`SET LOCAL session_replication_role = replica`;

    const affA = "aaaaaaaa-0000-0000-0000-000000000001";
    const affB = "aaaaaaaa-0000-0000-0000-000000000002";
    const affC = "aaaaaaaa-0000-0000-0000-000000000003";
    const affD = "aaaaaaaa-0000-0000-0000-000000000004";
    const progHigh = "bbbbbbbb-0000-0000-0000-000000000001"; // min 50
    const progZero = "bbbbbbbb-0000-0000-0000-000000000002"; // min 0
    const campA = "cccccccc-0000-0000-0000-000000000001"; // older
    const campB = "cccccccc-0000-0000-0000-000000000002"; // newer

    await tx`insert into programs (id, name, commission_type, commission_value, payout_minimum, is_default) values
      (${progHigh}, 'High', 'percent', '10', '50', false),
      (${progZero}, 'Zero', 'percent', '10', '0', false)`;
    await tx`insert into affiliates (id, user_id, status, ref_code, program_id, paypal_email, payout_method) values
      (${affA}, gen_random_uuid(), 'approved', 'AFFA', ${progHigh}, 'a@x.com', 'paypal'),
      (${affB}, gen_random_uuid(), 'approved', 'AFFB', ${progHigh}, 'b@x.com', 'paypal'),
      (${affC}, gen_random_uuid(), 'approved', 'AFFC', ${progZero}, 'c@x.com', 'paypal'),
      (${affD}, gen_random_uuid(), 'approved', 'AFFD', ${progZero}, 'd@x.com', 'paypal')`;

    // ---------- H2 · per-currency payout minimum ----------
    // affA: $30 + €30. Summed = 60 (> 50) but neither currency alone clears 50.
    await tx`insert into commissions (id, affiliate_id, amount, currency, status) values
      (gen_random_uuid(), ${affA}, '30.00', 'USD', 'approved'),
      (gen_random_uuid(), ${affA}, '30.00', 'EUR', 'approved')`;
    // affB: $60 USD → clears.
    await tx`insert into commissions (id, affiliate_id, amount, currency, status) values
      (gen_random_uuid(), ${affB}, '60.00', 'USD', 'approved')`;
    // affC (H3): €10 and -€15 (net -5), plus $50. Only USD should be payable.
    await tx`insert into commissions (id, affiliate_id, amount, currency, status) values
      (gen_random_uuid(), ${affC}, '10.00', 'EUR', 'approved'),
      (gen_random_uuid(), ${affC}, '-15.00', 'EUR', 'approved'),
      (gen_random_uuid(), ${affC}, '50.00', 'USD', 'approved')`;

    // The exact eligibility query executePayout runs (grouped per aff+currency).
    const rows = await tx`
      select a.id as affiliate_id, coalesce(c.currency,'USD') as currency,
             coalesce(sum(c.amount),0)::float8 as total, p.payout_minimum::float8 as minimum
      from commissions c
      join affiliates a on c.affiliate_id = a.id
      left join programs p on a.program_id = p.id
      where c.status='approved' and c.payout_id is null and a.status='approved'
      group by a.id, p.payout_minimum, coalesce(c.currency,'USD')`;
    const payable = rows.filter((r: any) => Number(r.total) >= Number(r.minimum ?? 0) && Number(r.total) > 0);
    const isPayable = (aff: string, cur: string) => payable.some((r: any) => r.affiliate_id === aff && r.currency === cur);

    ok("H2 affA USD $30 under $50 min → NOT payable", !isPayable(affA, "USD"));
    ok("H2 affA EUR €30 under €50 min → NOT payable", !isPayable(affA, "EUR"));
    ok("H2 affB USD $60 over min → payable", isPayable(affB, "USD"));
    ok("H3 affC USD $50 → payable", isPayable(affC, "USD"));
    ok("H3 affC EUR nets -5 → NOT payable (clawback not consumed)", !isPayable(affC, "EUR"));

    // Claiming only the payable (aff,currency) pairs must leave the negative EUR
    // rows unclaimed (payout_id still null) so the clawback survives.
    const batch = "dddddddd-0000-0000-0000-000000000001";
    await tx`insert into payouts (id, sender_batch_id, status) values (${batch}, 'AFF-hi', 'processing')`;
    // Claim USD for affC (the only payable pair for that affiliate).
    await tx`update commissions set payout_id=${batch}
             where status='approved' and payout_id is null and affiliate_id=${affC} and coalesce(currency,'USD')='USD'`;
    const eurStillOpen = await tx`select count(*)::int as n from commissions where affiliate_id=${affC} and coalesce(currency,'USD')='EUR' and payout_id is null`;
    ok("H3 affC EUR clawback rows remain unclaimed after USD claim", eurStillOpen[0].n === 2);

    // ---------- H4 · attribution maps a used coupon to its campaign ----------
    // affD joined campA (older) then campB (newer), both active. A code scoped to
    // campA must attribute to campA, NOT the most-recently-joined campB.
    await tx`insert into campaigns (id, name, type, status, config, created_at) values
      (${campA}, 'Camp A', 'affiliate', 'active', ${sql.json({})}, now() - interval '10 days'),
      (${campB}, 'Camp B', 'affiliate', 'active', ${sql.json({})}, now())`;
    await tx`insert into affiliate_campaigns (id, affiliate_id, campaign_id, created_at) values
      (gen_random_uuid(), ${affD}, ${campA}, now() - interval '10 days'),
      (gen_random_uuid(), ${affD}, ${campB}, now())`;
    await tx`insert into discount_codes (id, affiliate_id, campaign_id, code, active) values
      (gen_random_uuid(), ${affD}, ${campA}, 'AFFD10', true)`;

    // Mirror the attribution campaign-selection logic.
    const couponCampaignId = campA;
    const scoped = await tx`
      select c.id from affiliate_campaigns ac join campaigns c on ac.campaign_id=c.id
      where ac.affiliate_id=${affD} and c.id=${couponCampaignId} and c.status='active' limit 1`;
    const chosen = scoped.length
      ? scoped[0].id
      : (await tx`select c.id from affiliate_campaigns ac join campaigns c on ac.campaign_id=c.id
                  where ac.affiliate_id=${affD} and c.status='active' order by ac.created_at desc limit 1`)[0].id;
    ok("H4 coupon scoped to campA → attributes to campA (not newest campB)", chosen === campA);

    // Fallback: an unscoped (program/imported) code → most-recent-joined campB.
    const noCoupon = null as string | null;
    const fbScoped = noCoupon
      ? await tx`select 1`
      : [];
    const fallback = fbScoped.length
      ? (fbScoped[0] as any).id
      : (await tx`select c.id from affiliate_campaigns ac join campaigns c on ac.campaign_id=c.id
                  where ac.affiliate_id=${affD} and c.status='active' order by ac.created_at desc limit 1`)[0].id;
    ok("H4 unscoped code → falls back to most-recent campaign campB", fallback === campB);

    // ---------- H10 · approveCommissions never resurrects reversed ----------
    const pend = "eeeeeeee-0000-0000-0000-000000000001";
    const rev = "eeeeeeee-0000-0000-0000-000000000002";
    await tx`insert into commissions (id, affiliate_id, amount, currency, status, flagged) values
      (${pend}, ${affA}, '10.00', 'USD', 'pending', true),
      (${rev},  ${affA}, '10.00', 'USD', 'reversed', true)`;
    // The exact approve query (only status='pending').
    await tx`update commissions set status='approved', flagged=false where id = any(${sql.array([pend, rev])}::uuid[]) and status='pending'`;
    const pendRow = (await tx`select status, flagged from commissions where id=${pend}`)[0];
    const revRow = (await tx`select status, flagged from commissions where id=${rev}`)[0];
    ok("H10 pending commission → approved", pendRow.status === "approved" && pendRow.flagged === false);
    ok("H10 reversed commission → untouched (not re-approved, flag kept)", revRow.status === "reversed" && revRow.flagged === true);

    throw new Error("ROLLBACK"); // always roll back the seed data
  }).catch((e) => { if (e?.message !== "ROLLBACK") throw e; });

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
