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
  await sql.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
