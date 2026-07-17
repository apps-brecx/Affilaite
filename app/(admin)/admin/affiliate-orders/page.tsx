import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ImportOrdersButton } from "@/components/admin/import-orders-button";
import { AffiliateOrdersView } from "@/components/admin/affiliate-orders-view";
import { listAffiliateOrders } from "@/lib/queries";
import { shopifyConfig } from "@/lib/integrations";

export const metadata = { title: "Affiliate Orders" };

export default async function AffiliateOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [allRows, shop] = await Promise.all([listAffiliateOrders(200), shopifyConfig()]);
  const shopDomain = shop.domain || null;
  // When linked from a commission (?q=<order#>), filter to that order.
  const needle = (q ?? "").trim().toLowerCase().replace(/^#/, "");
  const rows = needle
    ? allRows.filter((o) => String(o.orderNumber).toLowerCase().replace(/^#/, "").includes(needle))
    : allRows;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Affiliate orders"
        description="Every order that used an affiliate code or link — who drove it, whether it earned a commission, and why."
      >
        <ImportOrdersButton />
      </PageHeader>

      {needle && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span>Filtered to order <span className="font-medium">{q}</span> · {rows.length} match{rows.length === 1 ? "" : "es"}</span>
          <Link href="/admin/affiliate-orders" className="font-medium text-primary hover:underline">Clear</Link>
        </div>
      )}

      <AffiliateOrdersView rows={rows} shopDomain={shopDomain} />
    </div>
  );
}
