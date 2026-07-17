import Link from "next/link";
import { DollarSign, Users, Clock, RefreshCcw, ArrowRight, Inbox, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RankBars } from "@/components/charts/charts";
import { EarningsPanel } from "@/components/affiliate/earnings-panel";
import { ApprovalQueue } from "@/components/admin/approval-queue";
import { getRevenueRange } from "@/app/actions/admin";
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
        <div className="lg:col-span-2">
          <EarningsPanel initial={series} initialRange="month" title="Affiliate-driven revenue" action={getRevenueRange} height={280} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top affiliates</CardTitle>
            <p className="text-sm text-muted-foreground">By lifetime earnings</p>
          </CardHeader>
          <CardContent>
            {top.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No affiliate earnings yet.</p>
            ) : (
              <RankBars items={top.map((a) => ({ name: a.name.split(" ")[0], value: a.totalEarned }))} />
            )}
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
          <CardContent>
            <ApprovalQueue pending={pending} />
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
          <CardContent className={orders.length ? "px-0 pb-2" : ""}>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
                <ShoppingBag className="size-6" />
                No attributed orders yet. They'll appear here as sales come in from Shopify.
              </div>
            ) : (
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
                    <TableCell className="text-muted-foreground">
                      {o.affiliateName ? (
                        o.affiliateName
                      ) : o.attributionStatus ? (
                        <span className="text-xs">{o.attributionStatus}</span>
                      ) : (
                        <span className="text-xs opacity-60">—</span>
                      )}
                    </TableCell>
                    <TableCell className="tnum font-medium">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
