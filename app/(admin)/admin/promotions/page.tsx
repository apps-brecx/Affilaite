import { Suspense } from "react";
import { BadgePercent, Calendar, ShoppingBag, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { PromotionForm } from "@/components/admin/promotion-form";
import { CreateReveal } from "@/components/admin/create-reveal";
import { PromotionsTabs } from "@/components/admin/promotions-tabs";
import { CatalogManager } from "@/components/admin/catalog-manager";
import { listPromotions } from "@/lib/queries";
import { getStoreProducts, getStoreCollections, getCatalogVisibility } from "@/lib/products";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Promotions" };

const CATALOG_CAP = 1000;

export default async function PromotionsPage() {
  // Header renders instantly; the catalog-dependent body streams in so the page
  // no longer sits blank for the full Shopify product fetch.
  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions"
        description="Time-boxed bonus commissions to spark a push, and control over the product catalog affiliates see."
      />
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-hairline py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading promotions & catalog…
          </div>
        }
      >
        <PromotionsBody />
      </Suspense>
    </div>
  );
}

async function PromotionsBody() {
  const [promos, catalog, collections, visibility] = await Promise.all([
    listPromotions(),
    getStoreProducts(CATALOG_CAP),
    getStoreCollections(250),
    getCatalogVisibility(),
  ]);

  const promotionsPanel = (
    <div className="space-y-6">
      <CreateReveal label="New promotion">
        <div className="max-w-xl">
          <PromotionForm products={catalog.products} connected={catalog.connected} error={catalog.error} />
        </div>
      </CreateReveal>
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          {promos.length === 0 && (
            <p className="rounded-lg border border-dashed border-hairline py-10 text-center text-sm text-muted-foreground">
              No promotions yet. Launch one to reward a burst of activity.
            </p>
          )}
          {promos.map((p) => (
            <Card key={p.id} className={p.status === "live" ? "border-success/30 ring-1 ring-success/10" : ""}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold ring-gilded">
                    <BadgePercent className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      <StatusPill status={p.status} />
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="size-3.5" /> {formatDate(p.startsAt)} — {formatDate(p.endsAt)} · {p.groupName}
                    </p>
                    {p.product && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <ShoppingBag className="size-3" /> Featuring <span className="font-medium text-foreground">{p.product.title}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold text-gold">
                    +{p.bonusType === "percent" ? `${p.bonusValue}%` : `$${p.bonusValue}`}
                  </p>
                  <p className="text-xs text-muted-foreground">bonus commission</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <PromotionsTabs
      promotionsPanel={promotionsPanel}
      catalogPanel={
        !catalog.connected ? (
          <p className="rounded-lg border border-dashed border-hairline py-10 text-center text-sm text-muted-foreground">
            Connect Shopify in Settings → Integrations to manage the product catalog.
          </p>
        ) : (
          <CatalogManager
            products={catalog.products.map((p) => ({
              id: p.id,
              title: p.title,
              image: p.image,
              price: p.price,
              currency: p.currency,
              available: p.available,
              collectionIds: p.collectionIds,
            }))}
            collections={collections.collections.map((c) => ({ id: c.id, title: c.title, productsCount: c.productsCount }))}
            initial={visibility}
            capped={catalog.products.length >= CATALOG_CAP}
          />
        )
      }
    />
  );
}
