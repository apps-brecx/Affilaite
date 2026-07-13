import { AppShell } from "@/components/shell/app-shell";
import { affiliateNav } from "@/lib/nav";
import { getCurrentAffiliate } from "@/lib/queries";

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentAffiliate();
  return (
    <AppShell
      variant="affiliate"
      sections={affiliateNav}
      user={{ name: me.name, email: me.email, role: "Affiliate Partner" }}
    >
      {children}
    </AppShell>
  );
}
