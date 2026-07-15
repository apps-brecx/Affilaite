"use server";

import { auth } from "@/lib/auth";
import { markRead, sectionForPath } from "@/lib/notifications";

/** Mark the current affiliate's notifications for a route as read. */
export async function markNotificationsReadByPath(path: string): Promise<void> {
  const session = await auth();
  const affiliateId = (session?.user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return;
  if (path === "/notifications") {
    await markRead(affiliateId, "all");
    return;
  }
  const section = sectionForPath(path);
  if (section) await markRead(affiliateId, section);
}
