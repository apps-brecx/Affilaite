import Link from "next/link";
import { Gift, MapPin, PackageOpen, Clock, Check, X, Truck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SampleCatalog } from "@/components/affiliate/sample-catalog";
import { PromoBanner } from "@/components/ui/promo-banner";
import { RevealSection } from "@/components/ui/reveal-section";
import { requireAffiliate } from "@/lib/session";
import { getMySampleRequests, getBanner } from "@/lib/queries";
import { getStoreProducts, getCatalogVisibility, resolveVisibleProducts, getSamplesConfig } from "@/lib/products";
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
  const [catalog, visibility, samplesConfig, mine, banner] = await Promise.all([
    getStoreProducts(1000),
    getCatalogVisibility(),
    getSamplesConfig(),
    getMySampleRequests(me.id),
    getBanner("samples"),
  ]);

  // Only products the affiliate can see in Promotions are sample-able — use the
  // exact same visibility rules as the Promotions catalog. Then the samples
  // curation narrows/orders that set; out-of-stock sinks to the bottom.
  const promoShown = resolveVisibleProducts(catalog.products, visibility);
  // Opt-out: sample-able = promo-visible minus anything the admin switched off.
  let shown = promoShown.filter((p) => !samplesConfig.hidden.includes(p.id));
  if (samplesConfig.order.length) {
    const pos = new Map(samplesConfig.order.map((id, i) => [id, i] as const));
    shown = [...shown].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9));
  }
  shown = [...shown].sort((a, b) => Number(a.available === false) - Number(b.available === false));
  const openProductIds = mine
    .filter((r) => (r.status === "requested" || r.status === "approved") && r.productId)
    .map((r) => r.productId as string);

  const hasAddress = !!me.address && me.address.trim().length > 0;
  const banned = me.samplesBanned;

  return (
    <div className="space-y-8">
      {/* Full-bleed hero banner across the top of the screen */}
      <PromoBanner banner={banner} fullBleed />

      <PageHeader
        title="Request samples"
        description="Get the products in your hands so you can create authentic content. Request a sample and we'll ship it to you after a quick review."
      />

      {banned && (
        <Card className="border-danger/30 bg-danger-soft/30">
          <CardContent className="flex items-start gap-3 p-5">
            <X className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="font-medium">Sample requests are disabled</p>
              <p className="text-sm text-muted-foreground">
                Your account can't request samples right now. Reach out to the team if you think this is a mistake.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!banned && !hasAddress && (
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

      {/* Request history — tucked behind a button */}
      {mine.length > 0 && (
        <RevealSection label="Your requests" icon={<Gift className="size-4" />} count={mine.length}>
          <Card>
          <CardContent className="space-y-3 pt-6">
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
                    {r.status === "shipped" && r.trackingNumber && (
                      <p className="mt-0.5 text-xs">
                        <span className="text-muted-foreground">{r.carrier ? `${r.carrier} · ` : ""}Tracking {r.trackingNumber}</span>
                        {r.trackingUrl && (
                          <a href={r.trackingUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 font-medium text-primary hover:underline">
                            Track
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                  <Badge variant={s.variant} className="shrink-0">
                    <Icon className="size-3" /> {s.label}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
          </Card>
        </RevealSection>
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
        ) : hasAddress && !banned ? (
          <SampleCatalog products={shown} openProductIds={openProductIds} />
        ) : (
          <p className="rounded-lg border border-dashed border-hairline py-8 text-center text-sm text-muted-foreground">
            {banned ? "Sample requests are disabled on your account." : "Add a shipping address above to request any of these products."}
          </p>
        )}
      </section>
    </div>
  );
}
