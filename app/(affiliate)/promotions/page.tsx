import { BadgePercent, Calendar, ShoppingBag, ExternalLink, Globe, PackageOpen, Sparkles } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { CopyButton } from "@/components/ui/copy-button";
import { CatalogBrowser } from "@/components/affiliate/catalog-browser";
import { PromoBanner } from "@/components/ui/promo-banner";
import { requireAffiliate } from "@/lib/session";
import { getPromotionsForAffiliate, getDefaultDestination, getBanner } from "@/lib/queries";
import {
  getStoreProducts,
  getCatalogConfig,
  applyCatalogConfig,
  getStoreCollections,
  getCollectionConfig,
  applyCollectionConfig,
} from "@/lib/products";
import { buildReferralLink } from "@/lib/links";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const me = await requireAffiliate();
  const [promos, catalog, config, collectionsRaw, collectionConfig, website, banner] = await Promise.all([
    getPromotionsForAffiliate(me),
    getStoreProducts(100),
    getCatalogConfig(),
    getStoreCollections(100),
    getCollectionConfig(),
    getDefaultDestination(),
    getBanner("promotions"),
  ]);

  const visibleProducts = applyCatalogConfig(catalog.products, config).map((p) => ({
    id: p.id,
    title: p.title,
    image: p.image,
    price: p.price,
    currency: p.currency,
    available: p.available,
    shareLink: buildReferralLink(me.refCode, p.url),
  }));

  const visibleCollections = applyCollectionConfig(collectionsRaw.collections, collectionConfig).map((c) => ({
    ...c,
    shareLink: buildReferralLink(me.refCode, c.url),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions & products"
        description="Live bonus offers, the full product catalog, and everything you need to promote — with your link baked in."
      >
        <Button variant="secondary" asChild>
          <a href={website} target="_blank" rel="noopener noreferrer">
            <Globe className="size-4" /> Visit website
          </a>
        </Button>
      </PageHeader>

      <PromoBanner banner={banner} />

      {/* Active promotions */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <BadgePercent className="size-4" /> Live offers
        </h2>
        {promos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-hairline py-8 text-center text-sm text-muted-foreground">
            No active promotions right now. Bonus commission periods will appear here when the team launches one.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {promos.map((p) => {
              const productLink = p.product ? buildReferralLink(me.refCode, p.product.url) : null;
              return (
                <Card key={p.id} className={p.status === "live" ? "border-success/30 ring-1 ring-success/10" : ""}>
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <span className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold ring-gilded">
                          <Sparkles className="size-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{p.name}</p>
                            <StatusPill status={p.status} />
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Calendar className="size-3.5" /> {formatDate(p.startsAt)} — {formatDate(p.endsAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-2xl font-semibold text-gold">
                          +{p.bonusType === "percent" ? `${p.bonusValue}%` : `$${p.bonusValue}`}
                        </p>
                        <p className="text-xs text-muted-foreground">bonus for you</p>
                      </div>
                    </div>

                    {p.product && productLink && (
                      <div className="flex items-center gap-3 rounded-xl border border-hairline bg-muted/30 p-3">
                        <span className="size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                          {p.product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.product.image} alt={p.product.title} className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-muted-foreground">
                              <ShoppingBag className="size-5" />
                            </span>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Featured item</p>
                          <p className="truncate text-sm font-medium">{p.product.title}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button size="sm" variant="secondary" asChild>
                            <a href={productLink} target="_blank" rel="noopener noreferrer">
                              Shop <ExternalLink className="size-3.5" />
                            </a>
                          </Button>
                          <CopyButton value={productLink} label="Copy link" />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Catalog — opt-in, collections + products together */}
      {visibleProducts.length === 0 && visibleCollections.length === 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ShoppingBag className="size-4" /> Catalog
          </h2>
          <EmptyState
            icon={PackageOpen}
            title={catalog.connected ? "No products to show yet" : "Catalog coming soon"}
            description={
              catalog.connected
                ? "Products and collections show up here once they're published in Shopify and made visible by the team."
                : "The catalog appears here once the store is connected. In the meantime, share your code and link from Links & Codes."
            }
          />
        </section>
      ) : (
        <CatalogBrowser products={visibleProducts} collections={visibleCollections} />
      )}
    </div>
  );
}
