"use server";

import { auth } from "@/lib/auth";
import {
  markRead,
  sectionForPath,
  getBadgeMap,
  listNotifications,
  type NotificationRow,
} from "@/lib/notifications";
import { getAdminNavBadges } from "@/lib/queries";

/** Admin sidebar red-dot counts (pending samples/applicants, unread DMs). */
export async function getAdminBadges(): Promise<Record<string, number>> {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return {};
  return getAdminNavBadges();
}

async function myAffiliateId(): Promise<string | undefined> {
  const session = await auth();
  return (session?.user as any)?.affiliateId as string | undefined;
}

/**
 * Mark the current affiliate's notifications for a route as read.
 * Only clears the section that matches the route — visiting the
 * Notifications inbox itself clears nothing (no matching section).
 */
export async function markNotificationsReadByPath(path: string): Promise<void> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return;
  const section = sectionForPath(path);
  if (section) await markRead(affiliateId, section);
}

/** Current unread badge map — polled by the shell for live updates. */
export async function getMyBadges(): Promise<Record<string, number>> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return {};
  return getBadgeMap(affiliateId);
}

/** Current notifications list — polled by the Notifications page for live updates. */
export async function getMyNotifications(): Promise<NotificationRow[]> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return [];
  return listNotifications(affiliateId);
}

/** Explicit "mark all as read" — used by the notifications bell. */
export async function markAllNotificationsRead(): Promise<void> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return;
  await markRead(affiliateId, "all");
}
