"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EarningsArea } from "@/components/charts/charts";
import { getMyEarnings, type EarningsRange } from "@/app/actions/affiliate";
import { formatCurrency, cn } from "@/lib/utils";
import type { TimePoint } from "@/lib/types";

const RANGES: { id: EarningsRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last week" },
  { id: "month", label: "Last month" },
  { id: "year", label: "Last year" },
  { id: "all", label: "All" },
];

export function EarningsPanel({
  initial,
  initialRange = "month",
}: {
  initial: TimePoint[];
  initialRange?: EarningsRange;
}) {
  const [range, setRange] = useState<EarningsRange>(initialRange);
  const [data, setData] = useState<TimePoint[]>(initial);
  const [pending, start] = useTransition();

  const total = data.reduce((s, p) => s + p.earnings, 0);
  const orders = data.reduce((s, p) => s + p.orders, 0);

  const select = (r: EarningsRange) => {
    if (r === range) return;
    setRange(r);
    start(async () => {
      const next = await getMyEarnings(r);
      setData(next);
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div>
          <CardTitle>Earnings</CardTitle>
          <p className="mt-1 tnum text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span> · {orders} order{orders === 1 ? "" : "s"}
          </p>
        </div>
        {/* Range selector — small squares */}
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-hairline bg-muted/40 p-1 no-scrollbar">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => select(r.id)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                range === r.id ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("transition-opacity", pending && "opacity-50")}>
          <EarningsArea data={data} height={320} />
        </div>
      </CardContent>
    </Card>
  );
}
