import { Badge, type BadgeProps } from "./badge";
import { cn } from "@/lib/utils";
import type { CommissionState, AffiliateState, PayoutState } from "@/lib/types";

type AnyStatus = CommissionState | AffiliateState | PayoutState | string;

const MAP: Record<string, { label: string; variant: BadgeProps["variant"]; dot: string }> = {
  // commission
  pending: { label: "Pending", variant: "warning", dot: "bg-warning" },
  approved: { label: "Approved", variant: "success", dot: "bg-success" },
  paid: { label: "Paid", variant: "default", dot: "bg-primary" },
  reversed: { label: "Reversed", variant: "danger", dot: "bg-danger" },
  rejected: { label: "Rejected", variant: "muted", dot: "bg-muted-foreground" },
  // affiliate
  suspended: { label: "Suspended", variant: "danger", dot: "bg-danger" },
  // payout
  draft: { label: "Draft", variant: "muted", dot: "bg-muted-foreground" },
  processing: { label: "Processing", variant: "warning", dot: "bg-warning" },
  success: { label: "Paid out", variant: "success", dot: "bg-success" },
  failed: { label: "Failed", variant: "danger", dot: "bg-danger" },
  // promotions
  live: { label: "Live", variant: "success", dot: "bg-success" },
  scheduled: { label: "Scheduled", variant: "warning", dot: "bg-warning" },
  ended: { label: "Ended", variant: "muted", dot: "bg-muted-foreground" },
};

export function StatusPill({ status, className }: { status: AnyStatus; className?: string }) {
  const s = MAP[status] ?? { label: status, variant: "muted" as const, dot: "bg-muted-foreground" };
  return (
    <Badge variant={s.variant} className={cn("pl-2", className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </Badge>
  );
}
