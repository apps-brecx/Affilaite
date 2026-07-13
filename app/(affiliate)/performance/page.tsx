import { MousePointerClick, ShoppingBag, Percent, Coins } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EarningsArea, ActivityBars } from "@/components/charts/charts";
import { getCurrentAffiliate, getAffiliateEarnings } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Performance" };

const PRODUCTS = [
  { name: "Signature Wool Coat", orders: 38, revenue: 22800, share: 34 },
  { name: "Cashmere Scarf", orders: 51, revenue: 9180, share: 22 },
  { name: "Leather Weekender", orders: 19, revenue: 11400, share: 18 },
  { name: "Silk Slip Dress", orders: 27, revenue: 6750, share: 14 },
  { name: "Merino Crew", orders: 33, revenue: 4620, share: 12 },
];

export default async function PerformancePage() {
  const me = await getCurrentAffiliate();
  const series = await getAffiliateEarnings(30);

  const funnel = [
    { label: "Clicks", value: me.clicks, pct: 100, color: "hsl(var(--chart-3))" },
    { label: "Added to cart", value: Math.round(me.clicks * 0.14), pct: 14, color: "hsl(var(--chart-2))" },
    { label: "Orders", value: me.orders, pct: me.conversionRate, color: "hsl(var(--chart-1))" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Performance" description="Understand what's converting — and where your earnings come from.">
        <div className="flex items-center gap-1 rounded-lg border border-hairline bg-card p-1 text-sm">
          {["7d", "30d", "90d", "All"].map((r) => (
            <button
              key={r}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                r === "30d" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Clicks" value={me.clicks} format="number" icon={MousePointerClick} accent="primary" delta={9.1} />
        <StatCard label="Orders" value={me.orders} format="number" icon={ShoppingBag} accent="gold" delta={12.7} />
        <StatCard label="Conversion" value={me.conversionRate} format="raw" decimals={1} deltaSuffix="pt" icon={Percent} accent="success" delta={0.4} />
        <StatCard label="Earnings / click" value={me.epc} format="currency" icon={Coins} accent="warning" delta={5.5} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Earnings over time</CardTitle>
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
                  <div className="h-full rounded-full" style={{ width: `${f.pct}%`, background: f.color }} />
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
            <CardTitle>Daily activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityBars data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top products you've sold</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="pr-6 text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PRODUCTS.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tnum text-muted-foreground">{p.orders}</TableCell>
                    <TableCell className="pr-6 text-right tnum font-medium">{formatCurrency(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
