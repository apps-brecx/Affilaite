import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Wallet, ExternalLink, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { PayoutRefresh } from "@/components/admin/payout-refresh";
import { PayoutExport } from "@/components/admin/payout-export";
import { requireAdmin } from "@/lib/session";
import { getPayout } from "@/lib/queries";
import { formatCurrency, formatDateTime } from "@/lib/utils";

export const metadata = { title: "Payout batch" };

// Map PayPal item transaction_status to a badge tone.
function itemBadge(status: string): "success" | "warning" | "danger" | "muted" {
  const s = status.toUpperCase();
  if (s === "SUCCESS") return "success";
  if (["PENDING", "UNCLAIMED", "ONHOLD", "NEW"].includes(s)) return "warning";
  if (["FAILED", "RETURNED", "BLOCKED", "REFUNDED", "REVERSED", "DENIED", "CANCELED"].includes(s)) return "danger";
  return "muted";
}

export default async function PayoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const batch = await getPayout(id);
  if (!batch) notFound();

  const paidTotal = batch.items
    .filter((i) => i.transactionStatus.toUpperCase() === "SUCCESS")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <Link href="/admin/payouts" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to payouts
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wallet className="size-6" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-xl font-semibold tracking-tight">{batch.senderBatchId}</h1>
              <StatusPill status={batch.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDateTime(batch.createdAt)} · {batch.affiliateCount} recipient{batch.affiliateCount === 1 ? "" : "s"}
              {batch.paypalBatchId ? <> · PayPal <span className="font-mono">{batch.paypalBatchId}</span></> : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PayoutExport payouts={[batch]} filename={`${batch.senderBatchId}.csv`} />
          {batch.paypalBatchId && batch.status === "processing" && <PayoutRefresh payoutId={batch.id} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Batch total</p><p className="mt-1 tnum text-2xl font-semibold">{formatCurrency(batch.totalAmount)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Actually paid</p><p className="mt-1 tnum text-2xl font-semibold text-success">{formatCurrency(paidTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recipients</p><p className="mt-1 tnum text-2xl font-semibold">{batch.items.length}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recipients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {batch.items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No line items on this batch.</p>
          )}
          {batch.items.map((i) => (
            <div key={i.id} className="flex flex-col gap-2 rounded-lg border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {i.affiliateId ? (
                  <Link href={`/admin/affiliates/${i.affiliateId}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary">
                    <User className="size-3.5" /> {i.affiliateName} <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                ) : (
                  <span className="font-medium">{i.affiliateName}</span>
                )}
                {i.affiliateEmail && <p className="truncate text-xs text-muted-foreground">{i.affiliateEmail}</p>}
                {i.paypalItemId && <p className="truncate text-[11px] font-mono text-muted-foreground/70">{i.paypalItemId}</p>}
              </div>
              <div className="flex items-center gap-4">
                <span className="tnum font-semibold">{formatCurrency(i.amount)} <span className="text-xs font-normal text-muted-foreground">{i.currency}</span></span>
                <Badge variant={itemBadge(i.transactionStatus)}>{i.transactionStatus}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
