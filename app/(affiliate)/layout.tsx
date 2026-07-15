import { AppShell } from "@/components/shell/app-shell";
import { affiliateNav } from "@/lib/nav";
import { requireAffiliate } from "@/lib/session";
import { getNotificationBadges, SECTION_HREF } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAffiliate();
  const { bySection, total } = await getNotificationBadges(me.id);

  // Map unread counts onto the nav routes; the Notifications tab shows the total.
  const badges: Record<string, number> = {};
  for (const [section, href] of Object.entries(SECTION_HREF)) {
    if (bySection[section]) badges[href] = bySection[section];
  }
  if (total) badges["/notifications"] = total;

  return (
    <AppShell
      variant="affiliate"
      sections={affiliateNav}
      user={{ name: me.name, email: me.email, role: "Affiliate Partner" }}
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
