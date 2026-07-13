"use client";

import { useState } from "react";
import { Wallet, ShieldCheck, Loader2, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface PayableRow {
  affiliateId: string;
  name: string;
  paypalEmail: string;
  amount: number;
}

export function PayoutRunner({ rows }: { rows: PayableRow[] }) {
  const [state, setState] = useState<"ready" | "processing" | "done">("ready");
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const run = () => {
    setState("processing");
    setTimeout(() => setState("done"), 2200);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> Payable this run
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} affiliates over their minimum with a valid PayPal email.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold tracking-tight">{formatCurrency(total)}</p>
          <Badge variant="secondary" className="mt-1">
            <Zap className="size-3" /> Sandbox mode
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline">
          {rows.map((r) => (
            <div key={r.affiliateId} className="flex items-center gap-3 p-3">
              <Avatar name={r.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.paypalEmail}</p>
              </div>
              {state === "done" ? (
                <Badge variant="success"><CheckCircle2 className="size-3" /> Sent</Badge>
              ) : (
                <span className="tnum text-sm font-semibold">{formatCurrency(r.amount)}</span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            Idempotent batch — a unique <code className="font-mono">sender_batch_id</code> prevents double-paying on retry.
          </div>
          {state === "ready" && (
            <Button onClick={run} className="shrink-0" size="lg">
              <Wallet className="size-4" /> Run PayPal payout
            </Button>
          )}
          {state === "processing" && (
            <Button disabled className="shrink-0" size="lg">
              <Loader2 className="size-4 animate-spin" /> Sending batch…
            </Button>
          )}
          {state === "done" && (
            <Button disabled className="shrink-0 bg-success text-success-foreground" size="lg">
              <CheckCircle2 className="size-4" /> {formatCurrency(total)} paid
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
