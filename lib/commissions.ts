// lib/commissions.ts — hold-window maturation + admin actions.
import { db } from "@/db";
import { commissions } from "@/db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";

/** Cron: pending → approved once the hold window has elapsed. */
export async function approveMaturedCommissions() {
  if (!db) return { approved: 0 };
  const rows = await db
    .update(commissions)
    .set({ status: "approved" })
    .where(and(eq(commissions.status, "pending"), lte(commissions.approvableAt, new Date())))
    .returning({ id: commissions.id });
  return { approved: rows.length };
}

export async function approveCommissions(ids: string[]) {
  if (!db || ids.length === 0) return;
  await db.update(commissions).set({ status: "approved" }).where(inArray(commissions.id, ids));
}

export async function reverseCommission(id: string) {
  if (!db) return;
  await db.update(commissions).set({ status: "reversed" }).where(eq(commissions.id, id));
}
