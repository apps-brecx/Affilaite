// Verifies that switching a campaign's approval to Automatic approves its pending
// commissions (but leaves fraud-flagged ones in review), via the exact UPDATE
// updateCampaignConfig runs. All inside a rolled-back transaction.
// Run: DATABASE_URL=postgres://postgres@127.0.0.1:5433/syruviaaite npx tsx scripts/test-campaign-approval.ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };

async function main() {
  await sql.begin(async (tx) => {
    const uid = "88888888-0000-4000-8000-000000000001";
    const aid = "88888888-0000-4000-8000-000000000002";
    const cid = "88888888-0000-4000-8000-000000000003";
    const oid1 = "88888888-0000-4000-8000-000000000004";
    const oid2 = "88888888-0000-4000-8000-000000000005";
    const oid3 = "88888888-0000-4000-8000-000000000006";
    const cmClean = "88888888-0000-4000-8000-000000000007"; // pending, not flagged
    const cmFlagged = "88888888-0000-4000-8000-000000000008"; // pending, flagged
    const cmOther = "88888888-0000-4000-8000-000000000009"; // pending, different campaign

    const other = "88888888-0000-4000-8000-00000000000a";
    await tx`insert into users (id, email, name, role) values (${uid}, 'ca@x.com', 'CA', 'affiliate')`;
    await tx`insert into affiliates (id, user_id, status, ref_code) values (${aid}, ${uid}, 'approved', 'CATEST')`;
    await tx`insert into campaigns (id, name, type, status) values (${cid}, 'C', 'affiliate', 'active')`;
    await tx`insert into campaigns (id, name, type, status) values (${other}, 'Other', 'affiliate', 'active')`;
    await tx`insert into orders (id, shopify_order_id) values (${oid1}, 'ca-1')`;
    await tx`insert into orders (id, shopify_order_id) values (${oid2}, 'ca-2')`;
    await tx`insert into orders (id, shopify_order_id) values (${oid3}, 'ca-3')`;
    await tx`insert into commissions (id, order_id, affiliate_id, campaign_id, amount, currency, status, flagged) values (${cmClean}, ${oid1}, ${aid}, ${cid}, '5.00', 'USD', 'pending', false)`;
    await tx`insert into commissions (id, order_id, affiliate_id, campaign_id, amount, currency, status, flagged) values (${cmFlagged}, ${oid2}, ${aid}, ${cid}, '5.00', 'USD', 'pending', true)`;
    await tx`insert into commissions (id, order_id, affiliate_id, campaign_id, amount, currency, status, flagged) values (${cmOther}, ${oid3}, ${aid}, ${other}, '5.00', 'USD', 'pending', false)`;

    // The exact update updateCampaignConfig runs when mode === 'auto'.
    const rows = await tx`update commissions set status='approved', approvable_at=now()
                          where campaign_id=${cid} and status='pending' and flagged=false
                          returning id`;

    ok("approved exactly 1 pending commission", rows.length === 1);
    const clean = await tx`select status from commissions where id=${cmClean}`;
    const flagged = await tx`select status from commissions where id=${cmFlagged}`;
    const otherC = await tx`select status from commissions where id=${cmOther}`;
    ok("clean pending → approved", clean[0].status === "approved");
    ok("fraud-flagged stays pending (in review)", flagged[0].status === "pending");
    ok("other campaign's pending untouched", otherC[0].status === "pending");

    throw new Error("ROLLBACK");
  }).catch((e) => { if (e?.message !== "ROLLBACK") throw e; });

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
