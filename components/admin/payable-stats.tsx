"use client";

import { useState } from "react";
import Link from "next/link";
import { Wallet, Users, CircleDollarSign, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Recipient { affiliateId: string; name: string; paypalEmail: string; amount: number }

/** The three payout KPIs; "Payable now" and "Recipients" expand to show who. */
export function PayableStats({ rows, payableNow, paidAllTime }: { rows: Recipient[]; payableNow: number; paidAllTime: number }) {
  const [open, setOpen] = useState(false);
  const clickable = rows.length > 0;

  const Tile = ({ label, value, icon: Icon, accent, onClick }: { label: string; value: string; icon: typeof Wallet; accent: string; onClick?: () => void }) => (
    <Card className={onClick ? "cursor-pointer transition-shadow hover:shadow-lift" : ""} onClick={onClick}>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 tnum text-2xl font-semibold">{value}</p>
        </div>
        <span className={`flex size-9 items-center justify-center rounded-lg ${accent}`}>
          {onClick ? <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /> : <Icon className="size-5" />}
        </span>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Payable now" value={formatCurrency(payableNow)} icon={Wallet} accent="bg-primary/10 text-primary" onClick={clickable ? () => setOpen((v) => !v) : undefined} />
        <Tile label="Recipients" value={String(rows.length)} icon={Users} accent="bg-gold/10 text-gold" onClick={clickable ? () => setOpen((v) => !v) : undefined} />
        <Tile label="Paid all-time" value={formatCurrency(paidAllTime)} icon={CircleDollarSign} accent="bg-success/10 text-success" />
      </div>

      {open && clickable && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payable recipients</p>
            {rows.map((r) => (
              <div key={r.affiliateId} className="flex items-center justify-between gap-3 rounded-lg border border-hairline p-2.5">
                <div className="min-w-0">
                  <Link href={`/admin/affiliates/${r.affiliateId}`} className="inline-flex items-center gap-1.5 font-medium hover:text-primary">
                    {r.name} <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                  {r.paypalEmail && <p className="truncate text-xs text-muted-foreground">{r.paypalEmail}</p>}
                </div>
                <span className="tnum font-semibold">{formatCurrency(r.amount)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
