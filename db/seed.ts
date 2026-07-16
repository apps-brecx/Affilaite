// db/seed.ts — minimal, honest starter data: the admin account + a default program.
// Everything else (affiliates, commissions, orders) arrives through real activity.
// Run with: DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run db:seed
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, isDbConfigured } from "./index";
import { users, programs } from "./schema";

async function main() {
  if (!isDbConfigured || !db) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  const email = (process.env.ADMIN_EMAIL ?? "bu@brecx.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "syruvia";

  const existingAdmin = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(password, 10);
    await db.insert(users).values({ email, name: "Sipfluence Admin", passwordHash, role: "admin" });
    console.log(`✅ Admin created: ${email}`);
  } else {
    console.log(`Admin already exists: ${email}`);
  }

  const defaultProgram = await db.query.programs.findFirst({ where: eq(programs.isDefault, true) });
  if (!defaultProgram) {
    await db.insert(programs).values({
      name: "Sipfluence Core",
      commissionType: "percent",
      commissionValue: "15",
      cookieWindowDays: 30,
      holdDays: 30,
      payoutMinimum: "25",
      isDefault: true,
    });
    console.log("✅ Default program created: Sipfluence Core (15%)");
  } else {
    console.log("Default program already exists.");
  }

  console.log("✅ Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
