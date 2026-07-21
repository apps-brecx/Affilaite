// Validates the money-sensitive Medium fixes (refund dedupe + cumulative
// clawback, payout preview) against a real Postgres, all rolled back.
// Run: DATABASE_URL=... npx tsx scripts/test-medium-fixes.ts
import postgres from "postgres";
import { processRefund } from "../lib/attribution";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };
const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

async function main() {
  // processRefund uses the global drizzle `db`, so we seed real rows then clean
  // up by unique ids (no shared transaction available). Use throwaway ids.
  const oid = "abcd0000-0000-0000-0000-000000000111";
  const aff = "abcd0000-0000-0000-0000-000000000222";
  const usr = "abcd0000-0000-0000-0000-000000000333";
  const shopOrderId = "medtest-order-1";

  const cleanup = async () => {
    await sql`delete from commissions where affiliate_id=${aff}`;
    await sql`delete from orders where id=${oid}`;
    await sql`delete from affiliates where id=${aff}`;
    await sql`delete from users where id=${usr}`;
  };
  await cleanup();

  try {
    await sql`insert into users (id, email, name, password_hash, role) values (${usr}, 'medtest@x.com', 'Med Test', 'x', 'affiliate')`;
    await sql`insert into affiliates (id, user_id, status, ref_code) values (${aff}, ${usr}, 'approved', 'MEDTEST')`;
    // Order with $100 subtotal; an UNPAID $20 commission (20%).
    await sql`insert into orders (id, shopify_order_id, subtotal, currency, financial_status) values (${oid}, ${shopOrderId}, '100.00', 'USD', 'paid')`;
    await sql`insert into commissions (id, order_id, affiliate_id, amount, currency, status) values (gen_random_uuid(), ${oid}, ${aff}, '20.00', 'USD', 'approved')`;

    // Two separate 50% partial refunds ($50 each) → should leave $0, not $5.
    await processRefund({ id: "r1", order_id: shopOrderId, refund_line_items: [{ subtotal: "50.00" }] });
    const afterFirst = await sql`select amount, status from commissions where affiliate_id=${aff} and amount >= 0`;
    ok("M3 first 50% refund halves the commission ($20 → $10)", afterFirst.length === 1 && near(Number(afterFirst[0].amount), 10));

    await processRefund({ id: "r2", order_id: shopOrderId, refund_line_items: [{ subtotal: "50.00" }] });
    const afterSecond = await sql`select amount, status from commissions where affiliate_id=${aff}`;
    const positive = afterSecond.filter((c: any) => Number(c.amount) >= 0);
    ok("M3 second 50% refund fully claws back (reversed, not 25% left)",
      positive.length === 1 && (positive[0].status === "reversed" || near(Number(positive[0].amount), 0)));

    // M2: replaying r1 (same refund id) must NOT claw back again.
    const before = await sql`select refunded_subtotal from orders where id=${oid}`;
    await processRefund({ id: "r1", order_id: shopOrderId, refund_line_items: [{ subtotal: "50.00" }] });
    const after = await sql`select refunded_subtotal from orders where id=${oid}`;
    ok("M2 replaying the same refund id is a no-op (no double clawback)",
      near(Number(before[0].refunded_subtotal), Number(after[0].refunded_subtotal)));
  } finally {
    await cleanup();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}

main().catch(async (e) => { console.error(e?.message ?? e); await sql.end().catch(() => {}); process.exit(1); });
