"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, ExternalLink, Search, ChevronRight, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency, relativeTime } from "@/lib/utils";
import type { AffiliateOrder } from "@/lib/types";

const statusVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  pending: "warning", approved: "success", paid: "success", reversed: "danger", rejected: "danger",
};

function OrderTable({ rows, shopDomain }: { rows: AffiliateOrder[]; shopDomain: string | null }) {
  const shopUrl = (id: string) => (shopDomain ? `https://${shopDomain}/admin/orders/${id}` : null);
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <ShoppingBag className="size-6" /> No orders here yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-6">Order</TableHead>
            <TableHead>Affiliate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Order total</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead className="pr-6 text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => {
            const url = shopUrl(o.shopifyOrderId);
            return (
              <TableRow key={o.id}>
                <TableCell className="pl-6">
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                      {o.orderNumber} <ExternalLink className="size-3 opacity-60" />
                    </a>
                  ) : (
                    <span className="font-medium">{o.orderNumber}</span>
                  )}
                </TableCell>
                <TableCell>
                  {o.affiliateName ? (
                    <div className="flex flex-col">
                      {o.affiliateId ? (
                        <Link href={`/admin/affiliates/${o.affiliateId}`} className="font-medium hover:underline">{o.affiliateName}</Link>
                      ) : (
                        <span className="font-medium">{o.affiliateName}</span>
                      )}
                      {o.affiliateCode && <span className="font-mono text-xs text-muted-foreground">{o.affiliateCode}</span>}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {o.commissionStatus ? (
                    <Badge variant={statusVariant[o.commissionStatus] ?? "default"}>{o.commissionStatus}</Badge>
                  ) : (
                    <Badge variant="warning" className="whitespace-normal text-xs font-normal">{o.attributionStatus ?? "not attributed"}</Badge>
                  )}
                </TableCell>
                <TableCell className="tnum">{formatCurrency(o.total)}</TableCell>
                <TableCell className="tnum font-medium">{o.commissionAmount != null ? formatCurrency(o.commissionAmount) : "—"}</TableCell>
                <TableCell className="pr-6 text-right text-xs text-muted-foreground">{relativeTime(o.createdAt)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface AffGroup { id: string | null; name: string; code: string | null; orders: AffiliateOrder[]; commission: number }

export function AffiliateOrdersView({ rows, shopDomain }: { rows: AffiliateOrder[]; shopDomain: string | null }) {
  const [tab, setTab] = useState<"all" | "by">("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null); // affiliate group key

  const groups = useMemo<AffGroup[]>(() => {
    const map = new Map<string, AffGroup>();
    for (const o of rows) {
      const key = o.affiliateId ?? "__none__";
      const g = map.get(key) ?? { id: o.affiliateId, name: o.affiliateName ?? "Unattributed", code: o.affiliateCode, orders: [], commission: 0 };
      g.orders.push(o);
      if (o.commissionStatus !== "reversed" && o.commissionStatus !== "rejected") g.commission += o.commissionAmount ?? 0;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.orders.length - a.orders.length);
  }, [rows]);

  const filteredGroups = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(n) || (g.code ?? "").toLowerCase().includes(n));
  }, [groups, q]);

  const current = selected ? groups.find((g) => (g.id ?? "__none__") === selected) : null;

  const Tab = ({ id, label }: { id: "all" | "by"; label: string }) => (
    <button
      onClick={() => { setTab(id); setSelected(null); }}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === id ? "bg-background text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-muted/40 p-1">
        <Tab id="all" label="All orders" />
        <Tab id="by" label="By affiliate" />
      </div>

      {tab === "all" && (
        <Card><CardContent className="px-0 py-2"><OrderTable rows={rows} shopDomain={shopDomain} /></CardContent></Card>
      )}

      {tab === "by" && !current && (
        <div className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search affiliate or code…" className="pl-9" />
          </div>
          <Card><CardContent className="space-y-1.5 p-3">
            {filteredGroups.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No affiliates match.</p>}
            {filteredGroups.map((g) => (
              <button
                key={g.id ?? "__none__"}
                onClick={() => setSelected(g.id ?? "__none__")}
                className="flex w-full items-center gap-3 rounded-lg border border-hairline p-3 text-left transition-colors hover:bg-accent/50"
              >
                <Avatar name={g.name} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{g.name}</p>
                  {g.code && <p className="font-mono text-xs text-muted-foreground">{g.code}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{g.orders.length} order{g.orders.length === 1 ? "" : "s"}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(g.commission)} commission</p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </CardContent></Card>
        </div>
      )}

      {tab === "by" && current && (
        <div className="space-y-3">
          <button onClick={() => setSelected(null)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> All affiliates
          </button>
          <div className="flex items-center gap-3">
            <Avatar name={current.name} size={40} />
            <div>
              <div className="flex items-center gap-2">
                {current.id ? (
                  <Link href={`/admin/affiliates/${current.id}`} className="font-display text-lg font-semibold hover:underline">{current.name}</Link>
                ) : (
                  <span className="font-display text-lg font-semibold">{current.name}</span>
                )}
                {current.code && <span className="font-mono text-xs text-muted-foreground">{current.code}</span>}
              </div>
              <p className="text-sm text-muted-foreground">{current.orders.length} orders · {formatCurrency(current.commission)} commission</p>
            </div>
          </div>
          <Card><CardContent className="px-0 py-2"><OrderTable rows={current.orders} shopDomain={shopDomain} /></CardContent></Card>
        </div>
      )}
    </div>
  );
}
