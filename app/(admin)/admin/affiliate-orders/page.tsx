import Link from "next/link";
import { ShoppingBag, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ImportOrdersButton } from "@/components/admin/import-orders-button";
import { listAffiliateOrders } from "@/lib/queries";
import { shopifyConfig } from "@/lib/integrations";
import { formatCurrency, relativeTime } from "@/lib/utils";

export const metadata = { title: "Affiliate Orders" };

const statusVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "success",
  paid: "success",
  reversed: "danger",
  rejected: "danger",
};

export default async function AffiliateOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [allRows, shop] = await Promise.all([listAffiliateOrders(200), shopifyConfig()]);
  const shopUrl = (id: string) => (shop.domain ? `https://${shop.domain}/admin/orders/${id}` : null);
  // When linked from a commission, filter to that order number.
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

      <Card>
        <CardContent className="px-0 py-2">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <ShoppingBag className="size-6" />
              No affiliate orders yet. Use “Import past orders” to pull in sales from Shopify,
              or they’ll appear here automatically as affiliate sales come in.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Order</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order total</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead className="pr-6 text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => {
                    const url = shopUrl(o.shopifyOrderId);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="pl-6">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-medium hover:underline"
                            >
                              {o.orderNumber}
                              <ExternalLink className="size-3 opacity-60" />
                            </a>
                          ) : (
                            <span className="font-medium">{o.orderNumber}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {o.affiliateName ? (
                            <div className="flex flex-col">
                              {o.affiliateId ? (
                                <Link href={`/admin/affiliates/${o.affiliateId}`} className="font-medium hover:underline">
                                  {o.affiliateName}
                                </Link>
                              ) : (
                                <span className="font-medium">{o.affiliateName}</span>
                              )}
                              {o.affiliateCode && (
                                <span className="font-mono text-xs text-muted-foreground">{o.affiliateCode}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {o.commissionStatus ? (
                            <Badge variant={statusVariant[o.commissionStatus] ?? "default"}>
                              {o.commissionStatus}
                            </Badge>
                          ) : (
                            <Badge variant="warning" className="whitespace-normal text-xs font-normal">
                              {o.attributionStatus ?? "not attributed"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="tnum">{formatCurrency(o.total)}</TableCell>
                        <TableCell className="tnum font-medium">
                          {o.commissionAmount != null ? formatCurrency(o.commissionAmount) : "—"}
                        </TableCell>
                        <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                          {relativeTime(o.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
