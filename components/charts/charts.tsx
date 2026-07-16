"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimePoint } from "@/lib/types";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";

// Recharts' ResponsiveContainer measures the DOM, so it renders differently on
// the server. Gate charts behind mount to avoid hydration mismatches.
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function ChartFrame({ height, children }: { height: number; children: React.ReactNode }) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} aria-hidden />;
  return <>{children}</>;
}

const AXIS = "hsl(var(--muted-foreground))";
const GRID = "hsl(var(--chart-grid))";

function TipShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-popover px-3 py-2 text-xs shadow-lift">
      {children}
    </div>
  );
}

function fmtDay(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Hero earnings area — single emerald hue, gradient fill, crosshair tooltip. */
export function EarningsArea({
  data,
  height = 260,
  color = "hsl(var(--chart-1))",
}: {
  data: TimePoint[];
  height?: number;
  color?: string;
}) {
  return (
    <ChartFrame height={height}>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDay}
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
          dy={8}
        />
        <YAxis
          tickFormatter={(v) => formatCompactCurrency(v)}
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as TimePoint;
            return (
              <TipShell>
                <div className="mb-1 font-medium text-foreground">{fmtDay(p.date)}</div>
                <div className="tnum text-sm font-semibold text-foreground">
                  {formatCurrency(p.earnings)}
                </div>
                <div className="tnum text-muted-foreground">{p.orders} orders</div>
              </TipShell>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="earnings"
          stroke={color}
          strokeWidth={2}
          fill="url(#earnFill)"
          activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
        />
      </AreaChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Compact inline sparkline for stat cards. */
export function Sparkline({
  data,
  color = "hsl(var(--chart-1))",
  height = 44,
}: {
  data: TimePoint[];
  color?: string;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="earnings"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#spark-${color})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Orders/clicks bars — recessive, rounded ends. */
export function ActivityBars({ data, height = 220 }: { data: TimePoint[]; height?: number }) {
  return (
    <ChartFrame height={height}>
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={fmtDay}
          tick={{ fill: AXIS, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          minTickGap={40}
          dy={8}
        />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as TimePoint;
            return (
              <TipShell>
                <div className="mb-1 font-medium text-foreground">{fmtDay(p.date)}</div>
                <div className="tnum text-foreground">{p.orders} orders</div>
                <div className="tnum text-muted-foreground">{p.clicks} clicks</div>
              </TipShell>
            );
          }}
        />
        <Bar dataKey="orders" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
    </ChartFrame>
  );
}

/** Horizontal ranking bars for leaderboards. */
export function RankBars({
  items,
}: {
  items: { name: string; value: number }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const palette = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={it.name} className="flex items-center gap-3">
          <div className="w-28 shrink-0 truncate text-sm text-muted-foreground">{it.name}</div>
          <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-muted/60">
            <div
              className="absolute inset-y-0 left-0 rounded-md transition-all"
              style={{
                width: `${(it.value / max) * 100}%`,
                background: palette[i % palette.length],
                opacity: 0.9,
              }}
            />
          </div>
          <div className="tnum w-20 shrink-0 text-right text-sm font-medium text-foreground">
            {formatCurrency(it.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
