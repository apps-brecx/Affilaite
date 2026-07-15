import { BadgePercent, Calendar, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { PromotionForm } from "@/components/admin/promotion-form";
import { PromotionsTabs } from "@/components/admin/promotions-tabs";
import { CatalogControl } from "@/components/admin/catalog-control";
import { listPromotions } from "@/lib/queries";
import { getStoreProducts, getCatalogConfig } from "@/lib/products";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const [promos, catalog, catalogConfig] = await Promise.all([
    listPromotions(),
    getStoreProducts(100),
    getCatalogConfig(),
  ]);

  const promotionsPanel = (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
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

      <PromotionForm products={catalog.products} connected={catalog.connected} error={catalog.error} />
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions"
        description="Time-boxed bonus commissions to spark a push, and control over the product catalog affiliates see."
      />

      <PromotionsTabs
        promotionsPanel={promotionsPanel}
        catalogPanel={
          <CatalogControl products={catalog.products} config={catalogConfig} connected={catalog.connected} />
        }
      />
    </div>
  );
}
