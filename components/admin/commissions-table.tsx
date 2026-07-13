"use client";

import { useMemo, useState } from "react";
import { Check, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Commission, CommissionState } from "@/lib/types";

const FILTERS: { label: string; value: CommissionState | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Paid", value: "paid" },
  { label: "Reversed", value: "reversed" },
];

export function CommissionsTable({ commissions }: { commissions: Commission[] }) {
  const [filter, setFilter] = useState<CommissionState | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => (filter === "all" ? commissions : commissions.filter((c) => c.status === filter)),
    [commissions, filter],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const total = rows.reduce((s, c) => s + c.amount, 0);

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
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            {rows.length} · <span className="tnum font-medium text-foreground">{formatCurrency(total)}</span>
          </span>
          <Button variant="secondary" size="sm">
            <Download className="size-4" /> CSV
          </Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            <Button size="sm" variant="outline"><RotateCcw className="size-4" /> Reverse</Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
              <Check className="size-4" /> Approve
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
                <TableCell className="font-medium">{c.orderNumber}</TableCell>
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
      </div>
    </div>
  );
}
