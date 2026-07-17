"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { setSetting } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

const SCHEDULES = [
  { id: "manual", label: "Manual only" },
  { id: "daily", label: "Every day" },
  { id: "weekly", label: "Every week" },
  { id: "biweekly", label: "Every 2 weeks" },
  { id: "monthly", label: "Every month" },
];

export function PaymentsSettings({ minimum, mode, schedule }: { minimum: string; mode: string; schedule: string }) {
  const [min, setMin] = useState(minimum || "25");
  const [payMode, setPayMode] = useState(mode || "manual");
  const [sched, setSched] = useState(schedule || "manual");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const save = () =>
    start(async () => {
      await setSetting("default_payout_minimum", min);
      await setSetting("payout_schedule", sched);
      const res = await setSetting("default_payout_mode", payMode);
      toast(res.ok ? "Payment settings saved." : res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" /> Payout defaults
        </CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
      </CardHeader>
      <CardContent className="grid max-w-xl gap-5">
        <div className="space-y-1.5">
          <Label>Default payout minimum</Label>
          <div className="relative w-40">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <Input type="number" value={min} onChange={(e) => setMin(e.target.value)} className="pl-7" />
          </div>
          <p className="text-xs text-muted-foreground">Affiliates must clear this in approved commissions to be paid.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="block">Default payout method</Label>
          <div className="inline-flex w-fit gap-1 rounded-lg border border-hairline bg-muted/40 p-1">
            {[
              { id: "automatic", label: "Automatic (PayPal)" },
              { id: "manual", label: "Manual" },
            ].map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setPayMode(o.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  payMode === o.id ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">New campaigns start with this. Each campaign can override it.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="block">Payout schedule</Label>
          <select
            value={sched}
            onChange={(e) => setSched(e.target.value)}
            className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm shadow-subtle"
          >
            {SCHEDULES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            How often payouts run automatically. Scheduled runs still respect each affiliate&apos;s payout minimum — only those over it get paid.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
