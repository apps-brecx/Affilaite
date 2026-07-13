import Link from "next/link";
import { DollarSign, Users, Clock, RefreshCcw, ArrowRight, Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EarningsArea, RankBars } from "@/components/charts/charts";
import {
  getAdminKpis,
  getRevenueSeries,
  getTopAffiliates,
  getPendingApprovals,
  listOrders,
} from "@/lib/queries";
import { formatCurrency, formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Command Center" };

export default async function AdminHome() {
  const [kpis, series, top, pending, orders] = await Promise.all([
    getAdminKpis(),
    getRevenueSeries(30),
    getTopAffiliates(5),
    getPendingApprovals(),
    listOrders(),
  ]);
  const revenue = series.reduce((s, p) => s + p.earnings, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Command Center"
        description="The full picture of your affiliate program — revenue, partners, and money owed."
      >
        <Button variant="secondary" asChild>
          <Link href="/admin/commissions">Review commissions</Link>
        </Button>
        <Button asChild>
          <Link href="/admin/payouts">
            Run payout <ArrowRight className="size-4" />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue via affiliates" value={kpis.affiliateRevenue} icon={DollarSign} accent="primary" delta={kpis.affiliateRevenueDelta} hint="last 30 days" />
        <StatCard label="Active affiliates" value={kpis.activeAffiliates} format="number" icon={Users} accent="gold" delta={kpis.activeAffiliatesDelta} />
        <StatCard label="Pending commissions" value={kpis.pendingCommissions} icon={Clock} accent="warning" hint={`${kpis.pendingCommissionsCount} awaiting hold`} />
        <StatCard label="Refund rate" value={kpis.refundRate} format="raw" decimals={1} deltaSuffix="pt" icon={RefreshCcw} accent="danger" delta={kpis.refundRateDelta} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Affiliate-driven revenue</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Last 30 days</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-semibold">{formatCurrency(revenue)}</p>
              <p className="text-xs text-success">▲ {kpis.affiliateRevenueDelta}% vs prior</p>
            </div>
          </CardHeader>
          <CardContent>
            <EarningsArea data={series} height={280} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top affiliates</CardTitle>
            <p className="text-sm text-muted-foreground">By lifetime earnings</p>
          </CardHeader>
          <CardContent>
            <RankBars items={top.map((a) => ({ name: a.name.split(" ")[0], value: a.totalEarned }))} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Approvals queue */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Approval queue</CardTitle>
            <Badge variant="warning">{pending.length} waiting</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">All caught up 🎉</p>
            )}
            {pending.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                <Avatar name={a.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.companyName ?? a.email} · applied {relativeTime(a.joinedAt)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft">
                    <X className="size-4" />
                  </Button>
                  <Button size="icon-sm" className="bg-success text-success-foreground hover:bg-success/90">
                    <Check className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/admin/affiliates">Manage all affiliates</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent orders */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent attributed orders</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/commissions">View ledger</Link>
            </Button>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Order</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="pr-6 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.slice(0, 6).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{o.orderNumber}</span>
                      {o.financialStatus === "refunded" && (
                        <Badge variant="danger" className="ml-2">refunded</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.affiliateName}</TableCell>
                    <TableCell className="tnum font-medium">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </TableCell>
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
