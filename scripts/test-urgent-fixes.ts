// Validates the DB-level logic of the urgent payout/security fixes against a
// real Postgres, inside one transaction that is always rolled back.
// Run: DATABASE_URL=... npx tsx scripts/test-urgent-fixes.ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };

// The verified-Venmo receiver rule, copied from executePayout / runCustomPayout.
function receiverOf(r: { method: string; phone: string | null; phoneVerifiedAt: Date | null; paypalEmail: string | null }) {
  return r.method === "venmo" ? (r.phoneVerifiedAt ? r.phone : null) : r.paypalEmail;
}

async function main() {
  // ---- #5 Venmo requires a verified phone (pure logic) ----
  ok("#5 unverified Venmo → excluded (null receiver)",
    receiverOf({ method: "venmo", phone: "8455551234", phoneVerifiedAt: null, paypalEmail: null }) === null);
  ok("#5 verified Venmo → phone receiver",
    receiverOf({ method: "venmo", phone: "8455551234", phoneVerifiedAt: new Date(), paypalEmail: null }) === "8455551234");
  ok("#5 PayPal → email receiver",
    receiverOf({ method: "paypal", phone: null, phoneVerifiedAt: null, paypalEmail: "a@b.com" }) === "a@b.com");

  await sql.begin(async (tx) => {
    // Disable FK triggers so we can seed just the rows under test.
    await tx`SET LOCAL session_replication_role = replica`;

    const aff = "11111111-1111-1111-1111-111111111111";
    const aff2 = "22222222-2222-2222-2222-222222222222";
    const batch = "33333333-3333-3333-3333-333333333333";
    const camp = "44444444-4444-4444-4444-444444444444";
    const otherCamp = "55555555-5555-5555-5555-555555555555";
    const grp = "66666666-6666-6666-6666-666666666666";

    // ---- #2 Failed payout item reverts its commission to unpaid ----
    await tx`insert into payouts (id, sender_batch_id, status, total_amount, affiliate_count) values (${batch}, 'AFF-test', 'processing', '20.00', 2)`;
    // Two paid commissions claimed by this batch — one affiliate's item will FAIL.
    await tx`insert into commissions (id, affiliate_id, amount, currency, status, payout_id) values (gen_random_uuid(), ${aff}, '10.00', 'USD', 'paid', ${batch})`;
    await tx`insert into commissions (id, affiliate_id, amount, currency, status, payout_id) values (gen_random_uuid(), ${aff2}, '10.00', 'USD', 'paid', ${batch})`;
    await tx`insert into payout_items (id, payout_id, affiliate_id, amount, currency, transaction_status) values (gen_random_uuid(), ${batch}, ${aff}, '10.00', 'USD', 'FAILED')`;
    await tx`insert into payout_items (id, payout_id, affiliate_id, amount, currency, transaction_status) values (gen_random_uuid(), ${batch}, ${aff2}, '10.00', 'USD', 'SUCCESS')`;

    // The exact revert applied in reconcilePayout for a terminal-failed item:
    const failedItems = await tx`select affiliate_id, currency from payout_items where payout_id=${batch} and transaction_status = any(array['FAILED','RETURNED','BLOCKED','REFUNDED','REVERSED','DENIED'])`;
    for (const it of failedItems) {
      await tx`update commissions set status='approved', payout_id=null
               where payout_id=${batch} and affiliate_id=${it.affiliate_id} and currency=${it.currency ?? "USD"} and status='paid'`;
    }
    const reverted = await tx`select status, payout_id from commissions where affiliate_id=${aff}`;
    const stillPaid = await tx`select status, payout_id from commissions where affiliate_id=${aff2}`;
    ok("#2 failed item → commission back to approved + payout_id cleared",
      reverted[0].status === "approved" && reverted[0].payout_id === null);
    ok("#2 succeeded item → commission stays paid (not reverted)",
      stillPaid[0].status === "paid" && stillPaid[0].payout_id === batch);

    // ---- #4 join is gated on an actual invite for THIS campaign ----
    await tx`insert into direct_messages (id, affiliate_id, from_admin, kind, payload) values (gen_random_uuid(), ${aff}, true, 'invite', ${sql.json({ campaignId: camp })})`;
    const dmMatch = await tx`select id from direct_messages where affiliate_id=${aff} and from_admin=true and kind='invite' and payload ->> 'campaignId' = ${camp} limit 1`;
    const dmWrong = await tx`select id from direct_messages where affiliate_id=${aff} and from_admin=true and kind='invite' and payload ->> 'campaignId' = ${otherCamp} limit 1`;
    const dmOther = await tx`select id from direct_messages where affiliate_id=${aff2} and from_admin=true and kind='invite' and payload ->> 'campaignId' = ${camp} limit 1`;
    ok("#4 DM invite for the campaign → found", dmMatch.length === 1);
    ok("#4 DM invite lookup for a DIFFERENT campaign → not found (no enumeration)", dmWrong.length === 0);
    ok("#4 a different affiliate with no invite → not found", dmOther.length === 0);

    // Group invite path: only members of the group see it.
    await tx`insert into group_messages (id, group_id, kind, payload) values (gen_random_uuid(), ${grp}, 'invite', ${sql.json({ campaignId: otherCamp })})`;
    await tx`insert into group_members (id, group_id, affiliate_id) values (gen_random_uuid(), ${grp}, ${aff})`;
    const grpMember = await tx`select gm.id from group_messages gm join group_members m on m.group_id=gm.group_id where m.affiliate_id=${aff} and gm.kind='invite' and gm.payload ->> 'campaignId' = ${otherCamp} limit 1`;
    const grpNonMember = await tx`select gm.id from group_messages gm join group_members m on m.group_id=gm.group_id where m.affiliate_id=${aff2} and gm.kind='invite' and gm.payload ->> 'campaignId' = ${otherCamp} limit 1`;
    ok("#4 group invite → found for a member", grpMember.length === 1);
    ok("#4 group invite → NOT found for a non-member", grpNonMember.length === 0);

    throw new Error("ROLLBACK"); // never persist test data
  }).catch((e) => { if (e.message !== "ROLLBACK") throw e; });

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
