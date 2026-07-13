import { Wallet, Users, CircleDollarSign, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Badge } from "@/components/ui/badge";
import { PayoutRunner } from "@/components/admin/payout-runner";
import { getPayableBatch, listPayouts, getAdminKpis } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Payouts" };

export default async function AdminPayoutsPage() {
  const [rows, payouts, kpis] = await Promise.all([getPayableBatch(), listPayouts(), getAdminKpis()]);
  const lifetimePaid = payouts.reduce((s, p) => s + p.totalAmount, 0);

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

      <PayoutRunner rows={rows} />

      <Card>
        <CardHeader>
          <CardTitle>Batch history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-3 rounded-lg border border-hairline p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Wallet className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{p.senderBatchId}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.createdAt)} · {p.affiliateCount} affiliates ·{" "}
                    <span className="font-mono">{p.paypalBatchId}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="tnum text-lg font-semibold">{formatCurrency(p.totalAmount)}</span>
                <StatusPill status={p.status} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
