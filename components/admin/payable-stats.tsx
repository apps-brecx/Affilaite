"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Users, CircleDollarSign, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { PaidRecipient } from "@/lib/queries";

interface Payable { affiliateId: string; name: string; paypalEmail: string; amount: number }

/** The three payout KPIs — each expands to show the underlying detail. */
export function PayableStats({
  rows,
  paid,
  payableNow,
  paidAllTime,
}: {
  rows: Payable[];
  paid: PaidRecipient[];
  payableNow: number;
  paidAllTime: number;
}) {
  const [open, setOpen] = useState<"payable" | "recipients" | "paid" | null>(null);
  const toggle = (k: "payable" | "recipients" | "paid") => setOpen((v) => (v === k ? null : k));

  const Tile = ({ id, label, value, icon: Icon, accent, disabled }: { id: "payable" | "recipients" | "paid"; label: string; value: string; icon: typeof Wallet; accent: string; disabled?: boolean }) => (
    <Card className={disabled ? "" : "cursor-pointer transition-shadow hover:shadow-lift"} onClick={disabled ? undefined : () => toggle(id)}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 tnum text-2xl font-semibold">{value}</p>
        </div>
        <span className={`flex size-9 items-center justify-center rounded-lg ${accent}`}>
          {disabled ? <Icon className="size-5" /> : <ChevronDown className={`size-4 transition-transform ${open === id ? "rotate-180" : ""}`} />}
        </span>
      </CardContent>
    </Card>
  );

  const Row = ({ href, name, sub, amount }: { href?: string; name: string; sub?: string; amount: number }) => (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-hairline p-2.5">
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="inline-flex items-center gap-1.5 font-medium hover:text-primary">
            {name} <ExternalLink className="size-3 text-muted-foreground" />
          </Link>
        ) : (
          <span className="font-medium">{name}</span>
        )}
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <span className="tnum font-semibold">{formatCurrency(amount)}</span>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile id="payable" label="Payable now" value={formatCurrency(payableNow)} icon={Wallet} accent="bg-primary/10 text-primary" disabled={rows.length === 0} />
        <Tile id="recipients" label="Recipients paid" value={String(paid.length)} icon={Users} accent="bg-gold/10 text-gold" disabled={paid.length === 0} />
        <Tile id="paid" label="Paid all-time" value={formatCurrency(paidAllTime)} icon={CircleDollarSign} accent="bg-success/10 text-success" disabled={paid.length === 0} />
      </div>

      {open === "payable" && rows.length > 0 && (
        <Card><CardContent className="space-y-2 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payable now</p>
          {rows.map((r) => <Row key={r.affiliateId} href={`/admin/affiliates/${r.affiliateId}`} name={r.name} sub={r.paypalEmail} amount={r.amount} />)}
        </CardContent></Card>
      )}

      {(open === "recipients" || open === "paid") && paid.length > 0 && (
        <Card><CardContent className="space-y-2 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {open === "paid" ? "Paid all-time — by affiliate" : "Affiliates paid"}
          </p>
          {paid.map((r) => (
            <Row
              key={r.affiliateId ?? r.email}
              href={r.affiliateId ? `/admin/affiliates/${r.affiliateId}` : undefined}
              name={r.name}
              sub={`${r.email}${r.payments > 1 ? ` · ${r.payments} payments` : ""}`}
              amount={r.total}
            />
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
