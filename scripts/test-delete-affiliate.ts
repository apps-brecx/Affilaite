// Verifies deleteAffiliate's delete order is FK-safe: seeds an affiliate with a
// row in every table that references them (FK triggers ON), runs the same delete
// order the action uses, and asserts it succeeds — all inside a rolled-back tx.
// Run: DATABASE_URL=... npx tsx scripts/test-delete-affiliate.ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
let pass = 0, fail = 0;
const ok = (name: string, cond: boolean) => { (cond ? pass++ : fail++); console.log(`${cond ? "✅" : "❌"} ${name}`); };

async function main() {
  await sql.begin(async (tx) => {
    const uid = "99999999-0000-0000-0000-000000000001";
    const aid = "99999999-0000-0000-0000-000000000002";
    const gid = "99999999-0000-0000-0000-000000000003";
    const mid = "99999999-0000-0000-0000-000000000004"; // group message
    const oid = "99999999-0000-0000-0000-000000000005"; // order
    const bid = "99999999-0000-0000-0000-000000000006"; // payout batch
    const cid = "99999999-0000-0000-0000-000000000007"; // campaign

    // Parents (FKs must resolve — triggers are ON here).
    await tx`insert into users (id, email, name, password_hash, role) values (${uid}, 'del-test@x.com', 'Del Test', 'x', 'affiliate')`;
    await tx`insert into affiliates (id, user_id, status, ref_code) values (${aid}, ${uid}, 'approved', 'DELTEST')`;
    await tx`insert into groups (id, name) values (${gid}, 'G')`;
    await tx`insert into group_messages (id, group_id, kind, body) values (${mid}, ${gid}, 'text', 'hi')`;
    await tx`insert into orders (id, shopify_order_id) values (${oid}, 'ord-del-1')`;
    await tx`insert into payouts (id, sender_batch_id, status) values (${bid}, 'DEL-b', 'processing')`;
    await tx`insert into campaigns (id, name, type, status) values (${cid}, 'C', 'affiliate', 'active')`;

    // One child row in every table that references the affiliate (or their user).
    await tx`insert into group_members (id, group_id, affiliate_id) values (gen_random_uuid(), ${gid}, ${aid})`;
    await tx`insert into direct_messages (id, affiliate_id, from_admin, kind, body) values (gen_random_uuid(), ${aid}, false, 'text', 'yo')`;
    await tx`insert into group_message_reads (id, message_id, affiliate_id) values (gen_random_uuid(), ${mid}, ${aid})`;
    await tx`insert into poll_votes (id, message_id, affiliate_id, option_index) values (gen_random_uuid(), ${mid}, ${aid}, 0)`;
    await tx`insert into posts (id, affiliate_id, url, platform) values (gen_random_uuid(), ${aid}, 'https://x.com/p', 'instagram')`;
    await tx`insert into discovered_posts (id, affiliate_id, platform, url, external_id, status) values (gen_random_uuid(), ${aid}, 'instagram', 'https://x.com/d', 'ext-del-1', 'new')`;
    await tx`insert into discount_codes (id, affiliate_id, code, active) values (gen_random_uuid(), ${aid}, 'DELCODE', true)`;
    await tx`insert into clicks (id, affiliate_id, visitor_id) values (gen_random_uuid(), ${aid}, 'vid')`;
    await tx`insert into commissions (id, order_id, affiliate_id, amount, currency, status) values (gen_random_uuid(), ${oid}, ${aid}, '10.00', 'USD', 'approved')`;
    await tx`insert into payout_items (id, payout_id, affiliate_id, amount, currency, transaction_status) values (gen_random_uuid(), ${bid}, ${aid}, '10.00', 'USD', 'PENDING')`;
    await tx`insert into sample_requests (id, affiliate_id, product_title, address_snapshot, status) values (gen_random_uuid(), ${aid}, 'Boba', '1 St', 'requested')`;
    await tx`insert into notifications (id, affiliate_id, section, title) values (gen_random_uuid(), ${aid}, 'dashboard', 'hi')`;
    await tx`insert into affiliate_campaigns (id, affiliate_id, campaign_id) values (gen_random_uuid(), ${aid}, ${cid})`;
    await tx`insert into password_reset_tokens (id, user_id, token_hash, expires_at) values (gen_random_uuid(), ${uid}, 'tokhash', now() + interval '1 hour')`;

    // The exact delete order deleteAffiliate uses.
    await tx`delete from poll_votes where affiliate_id=${aid}`;
    await tx`delete from group_message_reads where affiliate_id=${aid}`;
    await tx`delete from direct_messages where affiliate_id=${aid}`;
    await tx`delete from notifications where affiliate_id=${aid}`;
    await tx`delete from posts where affiliate_id=${aid}`;
    await tx`delete from discovered_posts where affiliate_id=${aid}`;
    await tx`delete from clicks where affiliate_id=${aid}`;
    await tx`delete from sample_requests where affiliate_id=${aid}`;
    await tx`delete from discount_codes where affiliate_id=${aid}`;
    await tx`delete from affiliate_campaigns where affiliate_id=${aid}`;
    await tx`delete from group_members where affiliate_id=${aid}`;
    await tx`delete from payout_items where affiliate_id=${aid}`;
    await tx`delete from commissions where affiliate_id=${aid}`;
    await tx`delete from affiliates where id=${aid}`;
    await tx`delete from password_reset_tokens where user_id=${uid}`;
    await tx`delete from users where id=${uid}`;

    const affGone = await tx`select count(*)::int as n from affiliates where id=${aid}`;
    const userGone = await tx`select count(*)::int as n from users where id=${uid}`;
    const commGone = await tx`select count(*)::int as n from commissions where affiliate_id=${aid}`;
    const batchKept = await tx`select count(*)::int as n from payouts where id=${bid}`;
    ok("affiliate row deleted", affGone[0].n === 0);
    ok("login user deleted", userGone[0].n === 0);
    ok("affiliate commissions deleted", commGone[0].n === 0);
    ok("payout batch itself preserved", batchKept[0].n === 1);

    throw new Error("ROLLBACK");
  }).catch((e) => { if (e?.message !== "ROLLBACK") throw e; });

  console.log(`\n${pass} passed, ${fail} failed`);
  await sql.end();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
