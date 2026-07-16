import { Wallet, ShieldCheck, CircleDollarSign } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VenmoForm } from "@/components/affiliate/venmo-form";
import { getAffiliateSummary, listPayouts } from "@/lib/queries";
import { requireAffiliate } from "@/lib/session";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Payouts" };

export default async function PayoutsPage() {
  const me = await requireAffiliate();
  const summary = await getAffiliateSummary(me);
  const allPayouts = await listPayouts();
  // Only payouts that included this affiliate.
  const myPayouts = allPayouts.filter((p) => p.items.some((i) => i.affiliateEmail === me.email || i.affiliateName === me.name));
  const progress = Math.min(100, (summary.approved / Math.max(summary.payoutMinimum, 1)) * 100);
  const overMin = summary.approved >= summary.payoutMinimum;

  return (
    <div className="space-y-8">
      <PageHeader title="Payouts" description="Your earnings, paid straight to your Venmo — no middlemen, no hidden fees." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Balance */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Available balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              <span className="font-display text-4xl font-semibold tracking-tight">
                {formatCurrency(summary.approved)}
              </span>
              {summary.approved > 0 && <Badge variant="success" className="mb-1.5">Ready to pay</Badge>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payout threshold</span>
                <span className="tnum font-medium">{formatCurrency(summary.payoutMinimum)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {overMin
                  ? "You're over the minimum — you'll be included in the next payout run."
                  : `Earn ${formatCurrency(Math.max(0, summary.payoutMinimum - summary.approved))} more to reach the payout threshold.`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-hairline pt-4">
              <div>
                <p className="text-xs text-muted-foreground">Pending (in hold)</p>
                <p className="tnum text-lg font-semibold">{formatCurrency(summary.pending)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Paid lifetime</p>
                <p className="tnum text-lg font-semibold">{formatCurrency(summary.paidLifetime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PayPal setting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" /> Payout method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VenmoForm defaultPhone={me.phone ?? ""} verified={me.phoneVerified} />
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              Your details are stored securely and never shared. Commissions are sent to your Venmo.
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Payout history</CardTitle>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleDollarSign className="size-3.5" /> Paid via Venmo
          </span>
        </CardHeader>
        <CardContent className={myPayouts.length ? "px-0 pb-2" : ""}>
          {myPayouts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payouts yet"
              description="Once your approved earnings are paid out, each payment will appear here with its PayPal transaction."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="pr-6 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPayouts.map((p) => {
                  const mine = p.items.find((i) => i.affiliateEmail === me.email || i.affiliateName === me.name);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6 font-medium">{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{p.senderBatchId}</TableCell>
                      <TableCell className="text-right tnum font-medium">{formatCurrency(mine?.amount ?? 0)}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <StatusPill status={p.status === "success" ? "paid" : p.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
