"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ArrowUp, ArrowDown, Save, Loader2, PackageOpen, GripVertical, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import type { CatalogConfig } from "@/lib/products";
import { cn } from "@/lib/utils";

export interface CurationItem {
  id: string;
  title: string;
  image: string | null;
  subtitle?: string;
}

/** Reusable "choose what affiliates see + reorder" list, for products or collections. */
export function CurationList({
  items,
  config,
  connected,
  noun,
  save,
  error,
}: {
  items: CurationItem[];
  config: CatalogConfig;
  connected: boolean;
  noun: string; // "products" | "collections"
  save: (cfg: { order: string[]; shown: string[] }) => Promise<{ ok: boolean; message: string }>;
  error?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(items.map((p) => [p.id, p])), [items]);
  const initialOrder = useMemo(() => {
    const pos = new Map(config.order.map((id, i) => [id, i] as const));
    return items
      .slice()
      .sort((a, b) => (pos.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (pos.get(b.id) ?? Number.MAX_SAFE_INTEGER))
      .map((p) => p.id);
  }, [items, config.order]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [shown, setShown] = useState<Set<string>>(new Set(config.shown));
  const [q, setQ] = useState("");
  const [dirty, setDirty] = useState(false);
  const dragRef = useRef<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const startDrag = (id: string) => {
    dragRef.current = id;
    setDragId(id);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDragId(null);
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[index], next[j]] = [next[j], next[index]];
    setOrder(next);
    setDirty(true);
  };

  const onDragEnter = (overId: string) => {
    const d = dragRef.current;
    if (!d || d === overId) return;
    setOrder((prev) => {
      const from = prev.indexOf(d);
      const to = prev.indexOf(overId);
      if (from === -1 || to === -1) return prev;
      const next = prev.slice();
      next.splice(from, 1);
      next.splice(to, 0, d);
      return next;
    });
    setDirty(true);
  };

  const toggleShown = (id: string) => {
    setShown((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setDirty(true);
  };

  const showAllFiltered = () => {
    setShown((prev) => {
      const next = new Set(prev);
      filtered.forEach((id) => next.add(id));
      return next;
    });
    setDirty(true);
  };

  const onSave = () =>
    start(async () => {
      const res = await save({ order, shown: [...shown] });
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
  const shownCount = order.filter((id) => shown.has(id)).length;

  if (!connected) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <PackageOpen className="size-6" />
          Connect Shopify to curate the {noun} affiliates see.
        </CardContent>
      </Card>
    );
  }
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <PackageOpen className="size-6" />
          {error ? (
            <>
              <span>Couldn&apos;t load {noun} from Shopify.</span>
              <span className="max-w-md text-xs text-danger">{error}</span>
            </>
          ) : (
            <span>No {noun} found in your Shopify store yet.</span>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Toggle the eye to show a {noun.replace(/s$/, "")} to affiliates — hidden by default. Drag to reorder.{" "}
          <span className="font-medium text-foreground">{shownCount}</span> of {order.length} shown.
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${noun}…`} className="h-9 w-48 pl-8" />
          </div>
          {q && (
            <Button size="sm" variant="outline" onClick={showAllFiltered} title="Show all matching">
              <Eye className="size-4" /> Show all
            </Button>
          )}
          <Button size="sm" onClick={onSave} disabled={pending || !dirty}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="divide-y divide-hairline p-0">
          {filtered.map((id) => {
            const p = byId.get(id)!;
            const isShown = shown.has(id);
            const realIndex = order.indexOf(id);
            return (
              <div
                key={id}
                draggable={!q}
                onDragStart={() => startDrag(id)}
                onDragEnter={() => onDragEnter(id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={endDrag}
                onDrop={endDrag}
                className={cn(
                  "flex select-none items-center gap-3 px-4 py-2.5 transition-colors",
                  !isShown && "opacity-55",
                  !q && "cursor-grab active:cursor-grabbing",
                  dragId === id && "bg-accent/60 opacity-60 ring-1 ring-inset ring-primary/30",
                )}
              >
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
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.subtitle ?? ""}
                    {isShown && <Badge variant="success">Shown</Badge>}
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
                  <Button variant="ghost" size="icon-sm" onClick={() => toggleShown(id)} title={isShown ? "Hide from affiliates" : "Show to affiliates"}>
                    {isShown ? <Eye className="size-4 text-primary" /> : <EyeOff className="size-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No {noun} match your search.</p>}
        </CardContent>
      </Card>
      {q && <p className="text-center text-xs text-muted-foreground">Clear the search to reorder.</p>}
    </div>
  );
}
