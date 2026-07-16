import Link from "next/link";
import { Gift, MapPin, PackageOpen, Clock, Check, X, Truck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SampleCatalog } from "@/components/affiliate/sample-catalog";
import { requireAffiliate } from "@/lib/session";
import { getMySampleRequests } from "@/lib/queries";
import { getStoreProducts, getCatalogConfig, applyCatalogConfig } from "@/lib/products";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Samples" };

const STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger"; icon: typeof Clock }> = {
  requested: { label: "Requested", variant: "warning", icon: Clock },
  approved: { label: "Approved", variant: "success", icon: Check },
  shipped: { label: "Shipped", variant: "success", icon: Truck },
  rejected: { label: "Not approved", variant: "danger", icon: X },
};

export default async function SamplesPage() {
  const me = await requireAffiliate();
  const [catalog, config, mine] = await Promise.all([
    getStoreProducts(100),
    getCatalogConfig(),
    getMySampleRequests(me.id),
  ]);

  const shown = applyCatalogConfig(catalog.products, config);
  const openProductIds = mine
    .filter((r) => (r.status === "requested" || r.status === "approved") && r.productId)
    .map((r) => r.productId as string);

  const hasAddress = !!me.address && me.address.trim().length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Request samples"
        description="Get the products in your hands so you can create authentic content. Request a sample and we'll ship it to you after a quick review."
      />

      {!hasAddress && (
        <Card className="border-warning/30 bg-warning-soft/30">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-warning" />
              <div>
                <p className="font-medium">Add a shipping address first</p>
                <p className="text-sm text-muted-foreground">
                  We need somewhere to send your samples. Add your address in Settings to start requesting.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/settings">Add address</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Request history */}
      {mine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="size-4 text-primary" /> Your requests
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mine.map((r) => {
              const s = STATUS[r.status] ?? STATUS.requested;
              const Icon = s.icon;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-4 rounded-lg border border-hairline p-3"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {r.productImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.productImage} alt={r.productTitle} className="size-full object-cover" />
                    ) : (
                      <Gift className="size-5 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.productTitle}</p>
                    <p className="text-xs text-muted-foreground">Requested {formatDate(r.createdAt)}</p>
                  </div>
                  <Badge variant={s.variant} className="shrink-0">
                    <Icon className="size-3" /> {s.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Catalog */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <PackageOpen className="size-4" /> Available products
        </h2>
        {shown.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={catalog.connected ? "No products to sample yet" : "Samples coming soon"}
            description={
              catalog.connected
                ? "Products show up here once they're published in Shopify and made visible by the team."
                : "The sample catalog appears here once the store is connected. Check back soon."
            }
          />
        ) : hasAddress ? (
          <SampleCatalog products={shown} openProductIds={openProductIds} />
        ) : (
          <p className="rounded-lg border border-dashed border-hairline py-8 text-center text-sm text-muted-foreground">
            Add a shipping address above to request any of these products.
          </p>
        )}
      </section>
    </div>
  );
}
