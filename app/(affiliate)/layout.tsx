import { AppShell } from "@/components/shell/app-shell";
import { BrandScope } from "@/components/marketing/brand-scope";
import { affiliateNav } from "@/lib/nav";
import { requireAffiliate } from "@/lib/session";
import { getBadgeMap } from "@/lib/notifications";
import { getBrand } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAffiliate();
  const [badges, brand] = await Promise.all([getBadgeMap(me.id), getBrand()]);

  return (
    <BrandScope brand={brand}>
      <AppShell
        variant="affiliate"
        sections={affiliateNav}
        user={{ name: me.name, email: me.email, role: "Affiliate Partner" }}
        badges={badges}
      >
        {children}
      </AppShell>
    </BrandScope>
  );
}
