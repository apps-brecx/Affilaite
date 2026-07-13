// db/seed.ts — populate a fresh Neon database with a starter program + affiliates.
// Run with: DATABASE_URL=... npm run db:seed
import { db, isDbConfigured } from "./index";
import { programs, groups, users, affiliates, discountCodes } from "./schema";

async function main() {
  if (!isDbConfigured || !db) {
    console.error("DATABASE_URL is not set — nothing to seed.");
    process.exit(1);
  }

  console.log("Seeding programs…");
  const [core] = await db
    .insert(programs)
    .values({
      name: "Core Partner",
      commissionType: "percent",
      commissionValue: "15",
      cookieWindowDays: 30,
      holdDays: 30,
      payoutMinimum: "25",
      isDefault: true,
    })
    .returning();

  await db.insert(programs).values([
    { name: "Elite Circle", commissionType: "percent", commissionValue: "25", cookieWindowDays: 60, holdDays: 21, payoutMinimum: "50" },
    { name: "Creator Flat", commissionType: "flat", commissionValue: "20", newCustomerOnly: true, payoutMinimum: "25" },
  ]);

  console.log("Seeding groups…");
  await db.insert(groups).values([
    { name: "VIP Creators", description: "Top performers." },
    { name: "Newsletter Partners", description: "Email-first affiliates." },
    { name: "Social & Video", description: "IG, TikTok, YouTube." },
  ]);

  console.log("Seeding affiliates…");
  const people = [
    { name: "Sarah Whitfield", email: "sarah@example.com", refCode: "SARAH" },
    { name: "Marcus Chen", email: "marcus@example.com", refCode: "MARCUS" },
    { name: "Elena Rossi", email: "elena@example.com", refCode: "ELENA" },
  ];

  for (const p of people) {
    const [u] = await db
      .insert(users)
      .values({ email: p.email, name: p.name, role: "affiliate" })
      .returning();
    const [aff] = await db
      .insert(affiliates)
      .values({
        userId: u.id,
        status: "approved",
        refCode: p.refCode,
        paypalEmail: p.email,
        programId: core.id,
      })
      .returning();
    await db.insert(discountCodes).values({
      affiliateId: aff.id,
      code: `${p.refCode}15`,
      percentage: "15",
      active: true,
    });
  }

  console.log("✅ Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
