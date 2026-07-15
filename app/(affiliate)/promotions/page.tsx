import { BadgePercent, Calendar, ShoppingBag, ExternalLink, Store, PackageOpen, Sparkles } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { CopyButton } from "@/components/ui/copy-button";
import { requireAffiliate } from "@/lib/session";
import { getPromotionsForAffiliate, getDefaultDestination } from "@/lib/queries";
import { getStoreProducts } from "@/lib/products";
import { buildReferralLink } from "@/lib/links";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const me = await requireAffiliate();
  const [promos, catalog, website] = await Promise.all([
    getPromotionsForAffiliate(me),
    getStoreProducts(24),
    getDefaultDestination(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions & products"
        description="Live bonus offers, the full product catalog, and everything you need to promote — with your link baked in."
      >
        <Button asChild>
          <a href={website} target="_blank" rel="noopener noreferrer">
            <Store className="size-4" /> Visit website <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </PageHeader>

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
            {promos.map((p) => (
              <Card key={p.id} className={p.status === "live" ? "border-success/30 ring-1 ring-success/10" : ""}>
                <CardContent className="flex items-center justify-between gap-4 p-5">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Product catalog */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <ShoppingBag className="size-4" /> Product catalog
          </h2>
          {catalog.products.length > 0 && (
            <Badge variant="secondary">{catalog.products.length} products</Badge>
          )}
        </div>

        {catalog.products.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={catalog.connected ? "No products found" : "Catalog coming soon"}
            description={
              catalog.connected
                ? "Your store didn't return any products yet. Once products are published in Shopify they'll show up here."
                : "The product catalog appears here once the store is connected. In the meantime, share your code and link from Links & Codes."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {catalog.products.map((product) => {
              const shareLink = buildReferralLink(me.refCode, product.url);
              return (
                <Card key={product.id} className="group flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
                  <div className="relative aspect-square bg-muted">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.title} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <PackageOpen className="size-8" />
                      </div>
                    )}
                    {!product.available && (
                      <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">{product.title}</p>
                    {product.price && (
                      <p className="text-sm font-semibold text-foreground">
                        {product.currency === "USD" ? "$" : ""}
                        {product.price}
                        {product.currency && product.currency !== "USD" ? ` ${product.currency}` : ""}
                      </p>
                    )}
                    <CopyButton value={shareLink} variant="full" label="Copy share link" className="w-full justify-center text-xs" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
