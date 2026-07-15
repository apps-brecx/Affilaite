import { AppShell } from "@/components/shell/app-shell";
import { affiliateNav } from "@/lib/nav";
import { requireAffiliate } from "@/lib/session";
import { getBadgeMap } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAffiliate();
  const badges = await getBadgeMap(me.id);

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
