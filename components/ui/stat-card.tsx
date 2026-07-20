import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";
import { Card } from "./card";

export function StatCard({
  label,
  value,
  format = "currency",
  delta,
  deltaSuffix = "%",
  hint,
  icon: Icon,
  accent = "primary",
  children,
  decimals,
}: {
  label: string;
  value?: number;
  format?: "currency" | "number" | "raw";
  delta?: number;
  deltaSuffix?: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "gold" | "success" | "warning" | "danger";
  children?: React.ReactNode;
  decimals?: number;
}) {
  const accentText = {
    primary: "text-primary",
    gold: "text-gold",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[accent];
  const accentBg = {
    primary: "bg-primary/10",
    gold: "bg-gold/10",
    success: "bg-success-soft",
    warning: "bg-warning-soft",
    danger: "bg-danger-soft",
  }[accent];

  const positive = (delta ?? 0) >= 0;

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          {value !== undefined && (
            <p className="font-display text-3xl font-semibold tracking-tight text-foreground">
              <CountUp value={value} format={format} decimals={decimals} />
            </p>
          )}
        </div>
        {Icon && (
          <span className={cn("flex size-9 items-center justify-center rounded-lg", accentBg)}>
            <Icon className={cn("size-4.5", accentText)} />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta !== undefined && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              positive ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}
            {deltaSuffix}
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>

      {children && <div className="-mx-1 mt-3">{children}</div>}
    </Card>
  );
}
