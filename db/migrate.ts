// db/migrate.ts — apply migrations non-interactively (safe for CI / Render).
// Skips gracefully when DATABASE_URL is absent so demo builds never fail.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("DATABASE_URL not set — skipping migrations (demo mode).");
    process.exit(0);
  }
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  console.log("Applying migrations…");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log("✅ Migrations applied.");

  // One-time data backfill (idempotent, runs after the migration transaction has
  // committed so the "cancelled" enum value is usable). Reclassifies fully
  // clawed-back commissions as "cancelled" and removes the legacy negative
  // "refund-adjustment" rows, so a cancelled order zeroes cleanly instead of
  // showing a negative balance. Only touches orders whose rows net to ~zero.
  try {
    const offset = sql`
      select "order_id" from "commissions"
      where "order_id" is not null
      group by "order_id"
      having sum(case when "amount" < 0 and "attributed_by" = 'refund-adjustment' then 1 else 0 end) > 0
         and coalesce(sum("amount"), 0) <= 0.01`;
    await sql`
      update "commissions" set "status" = 'cancelled'
      where "amount" >= 0
        and "status" in ('pending', 'approved', 'paid')
        and "order_id" in (${offset})`;
    await sql`
      delete from "commissions"
      where "amount" < 0
        and "attributed_by" = 'refund-adjustment'
        and "order_id" in (${offset})`;
    // Any commission still tied to a cancelled order must read as cancelled — never
    // Pending/Approved (e.g. a stale replay that re-attributed a cancelled order).
    await sql`
      update "commissions" set "status" = 'cancelled'
      where "amount" >= 0
        and "status" in ('pending', 'approved', 'paid')
        and "order_id" in (select "id" from "orders" where "financial_status" = 'cancelled')`;
    console.log("✅ Cancelled-commission backfill complete.");
  } catch (e) {
    console.error("[backfill:cancelled]", e);
  }

  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
