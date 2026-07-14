"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Sparkles, Loader2, CheckCircle2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { bulkCreateDiscounts } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

interface Target {
  id: string;
  name: string;
  refCode: string;
}

type Phase = "idle" | "running" | "done";

export function DiscountGenerator({ targets }: { targets: Target[] }) {
  const [prefix, setPrefix] = useState("");
  const [percent, setPercent] = useState(15);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState<string[]>([]);
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const preview = useMemo(
    () =>
      targets.map((t) => ({
        ...t,
        code: `${prefix}${t.refCode}${percent}`.toUpperCase(),
      })),
    [targets, prefix, percent],
  );

  const run = () => {
    setPhase("running");
    setProgress(0);
    setCreated([]);
    // Optimistic per-code progress animation while the server action runs.
    let i = 0;
    const step = () => {
      if (i >= preview.length) return;
      i++;
      setProgress(Math.round((i / preview.length) * 100));
      setCreated((prev) => [...prev, preview[i - 1].code]);
      if (i < preview.length) setTimeout(step, 70);
    };
    setTimeout(step, 150);

    start(async () => {
      const res = await bulkCreateDiscounts(percent, prefix);
      setProgress(100);
      setCreated(preview.map((p) => p.code));
      setPhase("done");
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Form */}
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-gold" /> Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <div className="rounded-lg border border-hairline bg-muted/40 px-3 py-2.5 text-sm">
              One code per approved affiliate ·{" "}
              <span className="font-medium text-foreground">{targets.length} codes</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prefix</Label>
              <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="SUMMER" />
            </div>
            <div className="space-y-1.5">
              <Label>Discount %</Label>
              <Input
                type="number"
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                min={1}
                max={90}
              />
            </div>
          </div>
          <div className="rounded-lg border border-hairline bg-muted/40 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Example</p>
            <p className="mt-0.5 font-mono font-medium">
              {`${prefix}${targets[0]?.refCode ?? "SARAH"}${percent}`.toUpperCase()}
            </p>
          </div>
          {phase !== "running" ? (
            <Button className="w-full" onClick={run} disabled={targets.length === 0}>
              <ShoppingBag className="size-4" /> Create {preview.length} in Shopify
            </Button>
          ) : (
            <Button className="w-full" disabled>
              <Loader2 className="size-4 animate-spin" /> Creating…
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Throttled to respect Shopify's GraphQL rate limits.
          </p>
        </CardContent>
      </Card>

      {/* Preview / progress */}
      <Card className="lg:col-span-2">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-4 text-primary" />
            {phase === "done" ? "Created" : "Preview"}
          </CardTitle>
          {phase === "done" && (
            <Badge variant="success">
              <CheckCircle2 className="size-3" /> {created.length} created
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {phase !== "idle" && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{phase === "done" ? "Complete" : "Creating in Shopify…"}</span>
                <span className="tnum">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {preview.map((p) => {
              const isDone = created.includes(p.code);
              return (
                <div
                  key={p.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                    isDone ? "border-success/30 bg-success-soft/40" : "border-hairline",
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-medium">{p.code}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{p.name}</p>
                  </div>
                  {isDone && <CheckCircle2 className="size-4 shrink-0 text-success" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
