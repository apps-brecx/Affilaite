import { MousePointerClick, ShoppingBag, Percent, Coins } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EarningsArea, ActivityBars } from "@/components/charts/charts";
import { getAffiliateEarnings, getAffiliateCommissions } from "@/lib/queries";
import { requireAffiliate } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Performance" };

export default async function PerformancePage() {
  const me = await requireAffiliate();
  const series = await getAffiliateEarnings(30, me.id);
  const commissions = await getAffiliateCommissions(me.id, 25);
  const hasActivity = me.clicks > 0 || me.orders > 0 || commissions.length > 0;

  const funnel = [
    { label: "Clicks", value: me.clicks, pct: 100, color: "hsl(var(--chart-3))" },
    { label: "Orders", value: me.orders, pct: me.conversionRate, color: "hsl(var(--chart-1))" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Performance" description="Your clicks, orders, and earnings — straight from the source." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Clicks" value={me.clicks} format="number" icon={MousePointerClick} accent="primary" hint="link visits" />
        <StatCard label="Orders" value={me.orders} format="number" icon={ShoppingBag} accent="gold" hint="attributed to you" />
        <StatCard label="Conversion" value={me.conversionRate} format="raw" decimals={1} icon={Percent} accent="success" hint="orders / clicks" />
        <StatCard label="Earnings / click" value={me.epc} format="currency" icon={Coins} accent="warning" hint="EPC" />
      </div>

      {!hasActivity ? (
        <EmptyState
          icon={ShoppingBag}
          title="No activity yet"
          description="Share your link and code to start earning. Your performance will appear here as sales come in."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Earnings — last 30 days</CardTitle>
              </CardHeader>
              <CardContent>
                <EarningsArea data={series} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 pt-2">
                {funnel.map((f) => (
                  <div key={f.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className="tnum font-medium">{f.value.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, f.pct)}%`, background: f.color }} />
                    </div>
                  </div>
                ))}
                <div className="mt-4 rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground">Click → order conversion</p>
                  <p className="font-display text-2xl font-semibold text-primary">{me.conversionRate}%</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Daily earnings</CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityBars data={series} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent commissions</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-6">Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="pr-6 text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="pl-6 font-medium">{c.orderNumber}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                        <TableCell className="text-right tnum font-medium">{formatCurrency(c.amount)}</TableCell>
                        <TableCell className="pr-6 text-right"><StatusPill status={c.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
