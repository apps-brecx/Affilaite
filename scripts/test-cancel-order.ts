// Verifies cancellation/refund handling: a fully cancelled order zeroes its
// commission cleanly (status "cancelled", no negative balance), the order still
// counts as 1, earnings drop off, and the legacy-data backfill converts old
// negative "refund-adjustment" rows.
// Run: DATABASE_URL=postgres://postgres@127.0.0.1:5433/syruviaaite npx tsx scripts/test-cancel-order.ts
import postgres from "postgres";
import { getAffiliate, getEarningsSeries } from "../lib/queries";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };

// Fixed hex UUIDs for a throwaway fixture.
const U = "aaaaaaaa-0000-4000-8000-000000000001";
const A = "aaaaaaaa-0000-4000-8000-000000000002";
const O = "aaaaaaaa-0000-4000-8000-000000000003";
const C1 = "aaaaaaaa-0000-4000-8000-000000000004"; // positive coupon commission
const C2 = "aaaaaaaa-0000-4000-8000-000000000005"; // legacy negative refund-adjustment

async function cleanup() {
  await sql`delete from notifications where affiliate_id = ${A}`;
  await sql`delete from commissions where affiliate_id = ${A}`;
  await sql`delete from orders where id = ${O}`;
  await sql`delete from affiliates where id = ${A}`;
  await sql`delete from users where id = ${U}`;
}

async function seedBase(commissionStatus: string) {
  await cleanup();
  await sql`insert into users (id, email, name, role) values (${U}, 'cancel-test@example.com', 'Cancel Test', 'affiliate')`;
  await sql`insert into affiliates (id, user_id, status, ref_code) values (${A}, ${U}, 'approved', 'CANCELTEST')`;
  await sql`insert into orders (id, shopify_order_id, order_number, subtotal, total, financial_status)
            values (${O}, 'shop-cancel-1', '154008587687', '9.60', '9.60', 'paid')`;
  await sql`insert into commissions (id, order_id, affiliate_id, amount, currency, attributed_by, status, created_at)
            values (${C1}, ${O}, ${A}, '1.44', 'USD', 'coupon', ${commissionStatus}, now())`;
}

async function main() {
  // ---- Scenario 1: NEW cancellation path (commission was paid → cancelled) ----
  await seedBase("cancelled"); // applyClawback would have set this
  {
    const me = await getAffiliate(A);
    ok("cancelled: order still counts as 1", me?.orders === 1);
    ok("cancelled: paid lifetime = 0 (not negative)", me?.paidEarnings === 0);
    ok("cancelled: approved = 0 (not negative)", me?.approvedEarnings === 0);
    ok("cancelled: pending = 0", me?.pendingEarnings === 0);
    const series = await getEarningsSeries(30, A);
    const total = series.reduce((s, p) => s + p.earnings, 0);
    ok("cancelled: earnings chart excludes the $1.44", Math.abs(total) < 0.001);
  }

  // ---- Scenario 2: a live PAID commission (control — should still show) ----
  await seedBase("paid");
  {
    const me = await getAffiliate(A);
    ok("paid control: order counts as 1", me?.orders === 1);
    ok("paid control: paid lifetime = 1.44", Math.abs((me?.paidEarnings ?? 0) - 1.44) < 0.001);
    const series = await getEarningsSeries(30, A);
    const total = series.reduce((s, p) => s + p.earnings, 0);
    ok("paid control: earnings chart shows 1.44", Math.abs(total - 1.44) < 0.001);
  }

  // ---- Scenario 3: LEGACY data backfill (paid +1.44 and approved -1.44) ----
  await seedBase("paid");
  await sql`insert into commissions (id, order_id, affiliate_id, amount, currency, attributed_by, status, created_at)
            values (${C2}, ${O}, ${A}, '-1.44', 'USD', 'refund-adjustment', 'approved', now())`;
  {
    // Before backfill: the negative row pollutes approved.
    const before = await getAffiliate(A);
    ok("legacy before: approved is negative (-1.44)", Math.abs((before?.approvedEarnings ?? 0) + 1.44) < 0.001);

    // Run the exact backfill SQL from db/migrate.ts.
    const offset = sql`
      select "order_id" from "commissions"
      where "order_id" is not null
      group by "order_id"
      having sum(case when "amount" < 0 and "attributed_by" = 'refund-adjustment' then 1 else 0 end) > 0
         and coalesce(sum("amount"), 0) <= 0.01`;
    await sql`update "commissions" set "status" = 'cancelled'
              where "amount" >= 0 and "status" in ('pending','approved','paid') and "order_id" in (${offset})`;
    await sql`delete from "commissions"
              where "amount" < 0 and "attributed_by" = 'refund-adjustment' and "order_id" in (${offset})`;

    const after = await getAffiliate(A);
    ok("legacy after: approved = 0 (no negative)", after?.approvedEarnings === 0);
    ok("legacy after: paid lifetime = 0", after?.paidEarnings === 0);
    ok("legacy after: order still counts as 1", after?.orders === 1);
    const [neg] = await sql`select count(*)::int as n from commissions where affiliate_id = ${A} and amount < 0`;
    ok("legacy after: negative adjustment rows removed", neg.n === 0);
    const [can] = await sql`select count(*)::int as n from commissions where affiliate_id = ${A} and status = 'cancelled'`;
    ok("legacy after: positive row reclassified as cancelled", can.n === 1);
  }

  await cleanup();
  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await sql.end(); process.exit(1); });
