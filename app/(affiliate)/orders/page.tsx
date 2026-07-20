import { Package, Truck, ExternalLink, ShoppingBag, CircleCheck } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAffiliate } from "@/lib/session";
import { getMyStoreOrders, type MyOrder } from "@/lib/customer-orders";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My Orders" };

function fulfillmentBadge(status: string) {
  const s = status.toUpperCase();
  if (s === "FULFILLED") return <Badge variant="success" className="gap-1"><CircleCheck className="size-3" /> Shipped</Badge>;
  if (s === "PARTIALLY_FULFILLED") return <Badge variant="warning">Partly shipped</Badge>;
  if (s === "IN_PROGRESS" || s === "SCHEDULED") return <Badge variant="warning">Preparing</Badge>;
  return <Badge variant="secondary">Processing</Badge>;
}

function OrderCard({ o }: { o: MyOrder }) {
  const money = o.total ? `${o.currency === "USD" ? "$" : ""}${o.total}${o.currency && o.currency !== "USD" ? ` ${o.currency}` : ""}` : "";
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-2 font-medium">
              {o.name}
              {fulfillmentBadge(o.fulfillmentStatus)}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(o.createdAt)}
              {money ? ` · ${money}` : ""}
              {o.financialStatus ? ` · ${o.financialStatus.toLowerCase()}` : ""}
            </p>
          </div>
          {o.statusUrl && (
            <a href={o.statusUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
              Track order <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        {/* Items */}
        <div className="flex flex-wrap gap-3">
          {o.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-hairline bg-background/50 p-1.5 pr-3">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image} alt="" className="size-10 rounded-md object-cover" />
              ) : (
                <span className="grid size-10 place-items-center rounded-md bg-muted text-muted-foreground"><ShoppingBag className="size-4" /></span>
              )}
              <span className="text-sm">
                <span className="font-medium">{l.title}</span>
                {l.quantity > 1 && <span className="text-muted-foreground"> ×{l.quantity}</span>}
              </span>
            </div>
          ))}
        </div>

        {/* Tracking */}
        {o.tracking.length > 0 && (
          <div className="space-y-1.5 rounded-lg bg-muted/60 p-3">
            {o.estimatedDelivery && (
              <p className="text-xs text-muted-foreground">Estimated delivery {formatDate(o.estimatedDelivery)}</p>
            )}
            {o.tracking.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <Truck className="size-4 text-primary" />
                <span className="text-muted-foreground">{t.company ?? "Carrier"}:</span>
                {t.url ? (
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    {t.number ?? "Track"} <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <span className="font-medium">{t.number}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function MyOrdersPage() {
  const me = await requireAffiliate();
  const { connected, accountFound, orders, error } = await getMyStoreOrders(me.email, 30);

  return (
    <div className="space-y-8">
      <PageHeader title="My Orders" description="Your own purchases from the store — track shipping and status in one place." />

      {!connected ? (
        <EmptyState icon={Package} title="Orders aren't available yet" description="Once the store is connected, your personal orders and tracking will appear here." />
      ) : error ? (
        <EmptyState icon={Package} title="Couldn't load your orders" description="Please try again in a moment." />
      ) : !accountFound ? (
        <EmptyState
          icon={ShoppingBag}
          title="Syruvia account not found"
          description={`We couldn't find a Syruvia customer account for ${me.email}. Place an order (or sign up) with this email and your orders will appear here.`}
        />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="Your account is connected — orders you place will show up here with live tracking."
        />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <OrderCard key={o.id} o={o} />
          ))}
        </div>
      )}
    </div>
  );
}
