// lib/notifications.ts — per-affiliate notifications powering the sidebar badges.
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export type NotifSection =
  | "dashboard"
  | "links"
  | "promotions"
  | "performance"
  | "payouts"
  | "assets"
  | "community"
  | "samples";

/** Which portal route each notification section maps to. */
export const SECTION_HREF: Record<NotifSection, string> = {
  dashboard: "/dashboard",
  links: "/links",
  promotions: "/promotions",
  performance: "/performance",
  payouts: "/payouts",
  assets: "/assets",
  community: "/community",
  samples: "/samples",
};

const HREF_SECTION = Object.fromEntries(
  Object.entries(SECTION_HREF).map(([section, href]) => [href, section as NotifSection]),
) as Record<string, NotifSection>;

export function sectionForPath(path: string): NotifSection | null {
  return HREF_SECTION[path] ?? null;
}

/** Insert a notification for one or many affiliates. Best-effort — never throws to the caller. */
export async function notify(
  affiliateIds: string | string[],
  section: NotifSection,
  title: string,
  body?: string,
  href?: string,
): Promise<void> {
  if (!db) return;
  const ids = (Array.isArray(affiliateIds) ? affiliateIds : [affiliateIds]).filter(Boolean);
  if (!ids.length) return;
  try {
    await db.insert(notifications).values(
      ids.map((affiliateId) => ({
        affiliateId,
        section,
        title,
        body: body ?? null,
        href: href ?? SECTION_HREF[section],
      })),
    );
  } catch (e) {
    console.error("[notify]", e);
  }
}

/** Unread counts keyed by section, plus the grand total, for one affiliate. */
export async function getNotificationBadges(
  affiliateId: string,
): Promise<{ bySection: Record<string, number>; total: number }> {
  if (!db) return { bySection: {}, total: 0 };
  const rows = await db
    .select({ section: notifications.section, count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.affiliateId, affiliateId), isNull(notifications.readAt)))
    .groupBy(notifications.section);
  const bySection: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const c = Number(r.count);
    bySection[r.section] = c;
    total += c;
  }
  return { bySection, total };
}

/** Build the sidebar badge map (href → unread count, plus /notifications total). */
export async function getBadgeMap(affiliateId: string): Promise<Record<string, number>> {
  const { bySection, total } = await getNotificationBadges(affiliateId);
  const badges: Record<string, number> = {};
  for (const [section, href] of Object.entries(SECTION_HREF)) {
    if (bySection[section]) badges[href] = bySection[section];
  }
  if (total) badges["/notifications"] = total;
  return badges;
}

export interface NotificationRow {
  id: string;
  section: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(affiliateId: string, limit = 60): Promise<NotificationRow[]> {
  if (!db) return [];
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.affiliateId, affiliateId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
  return rows.map((n) => ({
    id: n.id,
    section: n.section,
    title: n.title,
    body: n.body,
    href: n.href,
    read: !!n.readAt,
    createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
  }));
}

/** Mark a section's unread notifications read — or every section when "all". */
export async function markRead(affiliateId: string, section: NotifSection | "all"): Promise<void> {
  if (!db) return;
  const base = and(eq(notifications.affiliateId, affiliateId), isNull(notifications.readAt));
  const cond = section === "all" ? base : and(base, eq(notifications.section, section));
  await db.update(notifications).set({ readAt: new Date() }).where(cond);
}
