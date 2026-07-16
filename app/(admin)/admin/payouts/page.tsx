import Link from "next/link";
import { Wallet, Users, CircleDollarSign, ChevronRight } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { PayoutRunner } from "@/components/admin/payout-runner";
import { CustomPayout } from "@/components/admin/custom-payout";
import { PayoutExport } from "@/components/admin/payout-export";
import { getPayableBatch, listPayouts, getAdminKpis, listAffiliates, paidAllTime } from "@/lib/queries";
import { reconcileProcessingPayouts } from "@/app/actions/admin";
import { paypalReady } from "@/lib/integrations";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Payouts" };

export default async function AdminPayoutsPage() {
  const paypalLive = await paypalReady();
  // Refresh any still-"processing" batches from PayPal before rendering, so the
  // history and "Paid all-time" reflect what actually cleared.
  if (paypalLive) await reconcileProcessingPayouts();

  const [rows, payouts, kpis, allAffiliates, lifetimePaid] = await Promise.all([
    getPayableBatch(),
    listPayouts(),
    getAdminKpis(),
    listAffiliates(),
    paidAllTime(),
  ]);
  const customRows = allAffiliates
    .filter((a) => a.status === "approved")
    .map((a) => ({ id: a.id, name: a.name, email: a.email, paypalEmail: a.paypalEmail }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Payouts"
        description="Pay every approved affiliate in one native PayPal batch — no third-party fees."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Payable now" value={kpis.payableNow} icon={Wallet} accent="primary" />
        <StatCard label="Recipients" value={rows.length} format="number" icon={Users} accent="gold" />
        <StatCard label="Paid all-time" value={lifetimePaid} icon={CircleDollarSign} accent="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {rows.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="Nothing payable right now"
              description="Affiliates appear here once they have approved commissions over their program minimum and a PayPal email on file."
            />
          ) : (
            <PayoutRunner rows={rows} live={paypalLive} />
          )}
        </div>
        <CustomPayout affiliates={customRows} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Batch history</CardTitle>
          {payouts.length > 0 && <PayoutExport payouts={payouts} />}
        </CardHeader>
        <CardContent className="space-y-3">
          {payouts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No payout batches yet.</p>
          )}
          {payouts.map((p) => (
            <Link
              key={p.id}
              href={`/admin/payouts/${p.id}`}
              className="flex flex-col gap-3 rounded-lg border border-hairline p-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{p.senderBatchId}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.createdAt)} · {p.affiliateCount} affiliate{p.affiliateCount === 1 ? "" : "s"}
                    {p.paypalBatchId ? <> · <span className="font-mono">{p.paypalBatchId}</span></> : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="tnum text-lg font-semibold">{formatCurrency(p.totalAmount)}</span>
                <StatusPill status={p.status} />
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
