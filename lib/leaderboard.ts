// lib/leaderboard.ts — gamified leaderboard: ranking, tiers, and badges.
import { db } from "@/db";
import { commissions, affiliates, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export interface Tier {
  name: string;
  emoji: string;
  color: string; // maps to a Tailwind accent
  min: number; // lifetime earned (approved + paid) threshold
}

// Highest first so `find(earned >= min)` returns the top tier reached.
export const TIERS: Tier[] = [
  { name: "Platinum", emoji: "💎", color: "text-violet-500", min: 5000 },
  { name: "Gold", emoji: "🥇", color: "text-amber-500", min: 2000 },
  { name: "Silver", emoji: "🥈", color: "text-sky-500", min: 500 },
  { name: "Bronze", emoji: "🥉", color: "text-orange-500", min: 0 },
];

export function tierFor(earned: number): Tier {
  return TIERS.find((t) => earned >= t.min) ?? TIERS[TIERS.length - 1];
}

/** The next tier up + how far to go, for a progress nudge. */
export function nextTier(earned: number): { tier: Tier; remaining: number } | null {
  const above = [...TIERS].reverse().find((t) => t.min > earned);
  return above ? { tier: above, remaining: Math.round((above.min - earned) * 100) / 100 } : null;
}

export interface Badge {
  emoji: string;
  label: string;
}

export function badgesFor(sales: number, earned: number, rank: number): Badge[] {
  const b: Badge[] = [];
  if (sales >= 1) b.push({ emoji: "🎉", label: "First sale" });
  if (sales >= 10) b.push({ emoji: "🔟", label: "10 orders" });
  if (sales >= 50) b.push({ emoji: "🚀", label: "50 orders" });
  if (earned >= 1000) b.push({ emoji: "💰", label: "$1k club" });
  if (rank >= 1 && rank <= 3) b.push({ emoji: "🏆", label: "Top 3" });
  return b;
}

export interface LeaderboardEntry {
  affiliateId: string;
  name: string;
  sales: number;
  earned: number;
  rank: number;
  tier: Tier;
  badges: Badge[];
}

/** Rank affiliates by realized earnings (approved + paid), with sales as tiebreak. */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  if (!db) return [];
  const earnedExpr = sql`coalesce(sum(${commissions.amount}) filter (where ${commissions.status} in ('approved','paid')),0)`;
  const rows = await db
    .select({
      affiliateId: commissions.affiliateId,
      name: users.name,
      email: users.email,
      sales: sql<number>`count(*) filter (where ${commissions.status} not in ('reversed','rejected'))`,
      earned: sql<string>`${earnedExpr}`,
    })
    .from(commissions)
    .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(sql`${commissions.amount} >= 0`)
    .groupBy(commissions.affiliateId, users.name, users.email)
    .orderBy(sql`${earnedExpr} desc, count(*) desc`)
    .limit(limit);

  return rows
    .filter((r) => r.affiliateId)
    .map((r, i) => {
      const earned = Number(r.earned);
      const sales = Number(r.sales);
      const rank = i + 1;
      return {
        affiliateId: r.affiliateId!,
        name: r.name ?? r.email ?? "Partner",
        sales,
        earned,
        rank,
        tier: tierFor(earned),
        badges: badgesFor(sales, earned, rank),
      };
    });
}
