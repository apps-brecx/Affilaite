import Link from "next/link";
import { Clock, CheckCircle2, Wallet, TrendingUp, ArrowRight, Sparkles } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EarningsPanel } from "@/components/affiliate/earnings-panel";
import { OnboardingChecklist } from "@/components/affiliate/onboarding";
import { CountUp } from "@/components/ui/count-up";
import {
  getAffiliateSummary,
  getAffiliateEarnings,
  getAffiliateCommissions,
} from "@/lib/queries";
import { requireAffiliate } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const me = await requireAffiliate();
  const summary = await getAffiliateSummary(me);
  const series = await getAffiliateEarnings(30, me.id);
  const commissions = await getAffiliateCommissions(me.id);
  const monthTotal = series.reduce((s, p) => s + p.earnings, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome, ${me.name.split(" ")[0]}`}
        description="Here's how your partnership is performing this month."
      >
        <Button variant="secondary" asChild>
          <Link href="/performance">
            <TrendingUp className="size-4" /> Performance
          </Link>
        </Button>
        <Button asChild>
          <Link href="/links">
            Share your link <ArrowRight className="size-4" />
          </Link>
        </Button>
      </PageHeader>

      <OnboardingChecklist me={me} />

      {/* Next payout banner */}
      <Card className="relative overflow-hidden border-primary/20">
        <div className="aurora pointer-events-none absolute inset-0" />
        <CardContent className="relative flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary ring-gilded">
              <Sparkles className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Approved &amp; ready — next payout</p>
              <p className="font-display text-2xl font-semibold tracking-tight">
                <CountUp value={summary.approved} format="currency" />
              </p>
            </div>
          </div>
          <Button variant="gold" asChild>
            <Link href="/payouts">Payout settings</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending" value={summary.pending} icon={Clock} accent="warning" hint="clearing hold period" />
        <StatCard label="Approved" value={summary.approved} icon={CheckCircle2} accent="success" hint="ready to pay" />
        <StatCard label="Paid lifetime" value={summary.paidLifetime} icon={Wallet} accent="primary" hint="sent to PayPal" />
        <StatCard label="This month" value={summary.thisMonth} icon={TrendingUp} accent="gold" hint="pending + approved" />
      </div>

      {/* Chart + recent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EarningsPanel initial={series} initialRange="month" height={280} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>At a glance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Glance label="Referral code" value={me.code} mono />
            <Glance label="Clicks (30d)" value={me.clicks.toLocaleString()} />
            <Glance label="Orders (30d)" value={String(me.orders)} />
            <Glance label="Conversion" value={`${me.conversionRate}%`} />
            <Glance label="Earnings / click" value={formatCurrency(me.epc)} accent />
            <Button variant="outline" className="w-full" asChild>
              <Link href="/links">
                Get your links <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent commissions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent commissions</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/performance">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className={commissions.length ? "px-0 pb-2" : ""}>
          {commissions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
              <Sparkles className="size-6 text-gold" />
              No commissions yet. Share your code and link — your first sale will show up here.
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Order</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="pr-6 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6 font-medium">{c.orderNumber}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground capitalize">{c.attributedBy}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="text-right font-medium tnum">{formatCurrency(c.amount)}</TableCell>
                  <TableCell className="pr-6 text-right">
                    <StatusPill status={c.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Glance({ label, value, mono, accent }: { label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium ${mono ? "font-mono" : ""} ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  );
}
