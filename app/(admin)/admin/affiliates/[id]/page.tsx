import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Ban, Mail, Building2, CircleDollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EarningsArea } from "@/components/charts/charts";
import { getAffiliate, getAffiliateCommissions, getAffiliateEarnings } from "@/lib/queries";
import { listAffiliates } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function generateStaticParams() {
  const all = await listAffiliates();
  return all.map((a) => ({ id: a.id }));
}

export default async function AffiliateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAffiliate(id);
  if (!a) notFound();
  const commissions = await getAffiliateCommissions(a.id);
  const series = await getAffiliateEarnings(30);

  return (
    <div className="space-y-8">
      <Link href="/admin/affiliates" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All affiliates
      </Link>

      {/* Identity header */}
      <Card className="relative overflow-hidden">
        <div className="aurora pointer-events-none absolute inset-0" />
        <CardContent className="relative flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={a.name} size={64} />
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-semibold tracking-tight">{a.name}</h2>
                <StatusPill status={a.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Mail className="size-3.5" />{a.email}</span>
                {a.companyName && <span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5" />{a.companyName}</span>}
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{a.code}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Ban className="size-4" /> Suspend</Button>
            <Button className="bg-success text-success-foreground hover:bg-success/90"><Check className="size-4" /> Approve</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Pending" value={a.pendingEarnings} accent="warning" />
        <StatCard label="Approved" value={a.approvedEarnings} accent="success" />
        <StatCard label="Paid lifetime" value={a.paidEarnings} accent="primary" />
        <StatCard label="Earnings / click" value={a.epc} accent="gold" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Earnings — last 30 days</CardTitle></CardHeader>
          <CardContent><EarningsArea data={series} /></CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Detail label="Program" value={a.programName} />
            <Detail label="Group" value={a.groupName ?? "—"} />
            <Detail label="PayPal" value={a.paypalEmail ?? "Not set"} warn={!a.paypalEmail} />
            <Detail label="Conversion" value={`${a.conversionRate}%`} />
            <Detail label="Clicks" value={a.clicks.toLocaleString()} />
            <Detail label="Joined" value={formatDate(a.joinedAt)} />
            <Button variant="outline" className="w-full">Reassign program</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Commission history</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleDollarSign className="size-3.5" /> {commissions.length} records
          </span>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Order</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="pr-6 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6 font-medium">{c.orderNumber}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{c.attributedBy}</TableCell>
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
  );
}

function Detail({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-hairline pb-3 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? "font-medium text-warning" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}
