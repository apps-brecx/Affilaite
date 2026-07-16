"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { approveCommissions, reverseCommissions } from "@/app/actions/admin";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Commission, CommissionState } from "@/lib/types";

const FILTERS: { label: string; value: CommissionState | "all" | "flagged" }[] = [
  { label: "All", value: "all" },
  { label: "Needs review", value: "flagged" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Paid", value: "paid" },
  { label: "Reversed", value: "reversed" },
];

export function CommissionsTable({ commissions }: { commissions: Commission[] }) {
  const [filter, setFilter] = useState<CommissionState | "all" | "flagged">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const run = (fn: (ids: string[]) => Promise<{ ok: boolean; message: string }>) => {
    const ids = [...selected];
    if (!ids.length) return;
    start(async () => {
      const res = await fn(ids);
      toast(res.message, res.ok ? "success" : "error");
      setSelected(new Set());
      router.refresh();
    });
  };

  const flaggedCount = useMemo(() => commissions.filter((c) => c.flagged).length, [commissions]);
  const rows = useMemo(
    () =>
      filter === "all"
        ? commissions
        : filter === "flagged"
          ? commissions.filter((c) => c.flagged)
          : commissions.filter((c) => c.status === filter),
    [commissions, filter],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const total = rows.reduce((s, c) => s + c.amount, 0);

  const exportCsv = () => {
    const header = ["Affiliate", "Order", "Source", "Date", "Order total", "Commission", "Status"];
    const lines = rows.map((c) =>
      [c.affiliateName, c.orderNumber, c.attributedBy, new Date(c.createdAt).toISOString().slice(0, 10), c.orderTotal, c.amount, c.status]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "commissions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-hairline bg-card p-1 text-sm no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                filter === f.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {f.value === "flagged" && flaggedCount > 0 && (
                <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-danger-foreground">
                  {flaggedCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {rows.length} · <span className="tnum font-medium text-foreground">{formatCurrency(total)}</span>
          </span>
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={pending}>Clear</Button>
            <Button size="sm" variant="outline" onClick={() => run(reverseCommissions)} disabled={pending}>
              <RotateCcw className="size-4" /> Reverse
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => run(approveCommissions)} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
            </Button>
          </div>
        </div>
      )}

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4" />
              <TableHead>Affiliate</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Order total</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                    className="size-4 rounded border-hairline accent-[hsl(var(--primary))]"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={c.affiliateName} size={30} />
                    <span className="font-medium">{c.affiliateName}</span>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    {c.orderNumber}
                    {c.flagged && (
                      <span title={c.flagReason ?? "Flagged for review"} className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">
                        <AlertTriangle className="size-3" /> Review
                      </span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={c.attributedBy === "coupon" ? "gold" : "secondary"} className="capitalize">
                    {c.attributedBy}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{formatCurrency(c.orderTotal)}</TableCell>
                <TableCell className="text-right tnum font-semibold">{formatCurrency(c.amount)}</TableCell>
                <TableCell><StatusPill status={c.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No commissions yet. They appear automatically when an attributed order comes in from Shopify.
          </p>
        )}
      </div>
    </div>
  );
}
