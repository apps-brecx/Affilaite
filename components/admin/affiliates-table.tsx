"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Check, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { Affiliate, AffiliateState } from "@/lib/types";

const FILTERS: { label: string; value: AffiliateState | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

export function AffiliatesTable({ affiliates }: { affiliates: Affiliate[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AffiliateState | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    return affiliates.filter((a) => {
      const matchesFilter = filter === "all" || a.status === filter;
      const matchesQ =
        !q ||
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.email.toLowerCase().includes(q.toLowerCase()) ||
        a.code.toLowerCase().includes(q.toLowerCase());
      return matchesFilter && matchesQ;
    });
  }, [affiliates, q, filter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, or code…"
            className="pl-9"
          />
        </div>
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
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90">
              <Check className="size-4" /> Approve selected
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
              <TableHead>Program</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Earned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined}>
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="size-4 rounded border-hairline accent-[hsl(var(--primary))]"
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/admin/affiliates/${a.id}`} className="flex items-center gap-3 group">
                    <Avatar name={a.name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground group-hover:text-primary">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.programName}</TableCell>
                <TableCell>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{a.code}</span>
                </TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{a.orders}</TableCell>
                <TableCell className="text-right tnum font-medium">{formatCurrency(a.totalEarned)}</TableCell>
                <TableCell>
                  <StatusPill status={a.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <Button size="icon-sm" variant="ghost">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No affiliates match your filters.</p>
        )}
      </div>
    </div>
  );
}
