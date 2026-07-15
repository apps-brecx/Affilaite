"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowUp, ArrowDown, Save, Loader2, PackageOpen, GripVertical, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveCatalogConfig } from "@/app/actions/admin";
import type { StoreProduct, CatalogConfig } from "@/lib/products";
import { cn } from "@/lib/utils";

export function CatalogControl({
  products,
  config,
  connected,
}: {
  products: StoreProduct[];
  config: CatalogConfig;
  connected: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Initial order: saved order first, then any new products, in default order.
  const initialOrder = useMemo(() => {
    const pos = new Map(config.order.map((id, i) => [id, i] as const));
    return products
      .slice()
      .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER))
      .map((p) => p.id);
  }, [products, config.order]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [hidden, setHidden] = useState<Set<string>>(new Set(config.hidden));
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[index], next[j]] = [next[j], next[index]];
    setOrder(next);
    setDirty(true);
  };

  const toggleHidden = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const res = await saveCatalogConfig({ order, hidden: [...hidden] });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setDirty(false);
        router.refresh();
      }
    });

  const filtered = order.filter((id) => {
    const p = byId.get(id);
    return p && (!q || p.title.toLowerCase().includes(q.toLowerCase()));
  });
  const visibleCount = order.filter((id) => !hidden.has(id)).length;

  if (!connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <PackageOpen className="size-6" />
          Connect Shopify to curate the catalog affiliates see.
        </CardContent>
      </Card>
    );
  }
  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <PackageOpen className="size-6" />
          No products returned from Shopify yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Choose what affiliates see and drag the order with the arrows.{" "}
            <span className="font-medium text-foreground">{visibleCount}</span> of {order.length} shown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="h-9 w-44 pl-8" />
          </div>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save order
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y divide-hairline p-0">
          {filtered.map((id) => {
            const p = byId.get(id)!;
            const isHidden = hidden.has(id);
            const realIndex = order.indexOf(id);
            return (
              <div key={id} className={cn("flex items-center gap-3 px-4 py-2.5", isHidden && "opacity-55")}>
                <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                <span className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">
                      <PackageOpen className="size-4" />
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.price ? `${p.currency === "USD" ? "$" : ""}${p.price}` : "—"}
                    {isHidden && <Badge variant="muted" className="ml-2">Hidden</Badge>}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon-sm" onClick={() => move(realIndex, -1)} disabled={realIndex === 0 || !!q} title="Move up">
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(realIndex, 1)}
                    disabled={realIndex === order.length - 1 || !!q}
                    title="Move down"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => toggleHidden(id)} title={isHidden ? "Show" : "Hide"}>
                    {isHidden ? <EyeOff className="size-4 text-muted-foreground" /> : <Eye className="size-4 text-primary" />}
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No products match your search.</p>}
        </CardContent>
      </Card>
      {q && <p className="text-center text-xs text-muted-foreground">Clear the search to reorder products.</p>}
    </div>
  );
}
