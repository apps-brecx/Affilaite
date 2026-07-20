"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Search, Star, Eye, EyeOff, Sparkles, Layers, PackageX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveCatalogVisibility } from "@/app/actions/admin";
import type { StoreProduct, StoreCollection, CatalogVisibility } from "@/lib/products";

type P = Pick<StoreProduct, "id" | "title" | "image" | "price" | "currency" | "available" | "collectionIds">;
type C = Pick<StoreCollection, "id" | "title" | "productsCount">;

export function CatalogManager({
  products,
  collections,
  initial,
  capped,
}: {
  products: P[];
  collections: C[];
  initial: CatalogVisibility;
  capped: boolean;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [term, setTerm] = useState("");
  const [tab, setTab] = useState<"products" | "collections">("collections");

  const [allowedCollections, setAllowedCollections] = useState<Set<string>>(new Set(initial.allowedCollections));
  const [allowedProducts, setAllowedProducts] = useState<Set<string>>(new Set(initial.allowedProducts));
  const [hiddenProducts, setHiddenProducts] = useState<Set<string>>(new Set(initial.hiddenProducts));
  const [featured, setFeatured] = useState<string[]>(initial.featured);

  const collById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  const isVisible = (p: P) => {
    if (hiddenProducts.has(p.id)) return false;
    if (allowedProducts.has(p.id)) return true;
    return p.collectionIds.some((c) => allowedCollections.has(c));
  };
  const visibleCount = useMemo(() => products.filter(isVisible).length, [products, allowedCollections, allowedProducts, hiddenProducts]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = t ? products.filter((p) => p.title.toLowerCase().includes(t)) : products;
    return list;
  }, [products, term]);
  const shown = filtered.slice(0, 200);

  const setMode = (id: string, mode: "auto" | "show" | "hide") => {
    setAllowedProducts((s) => { const n = new Set(s); mode === "show" ? n.add(id) : n.delete(id); return n; });
    setHiddenProducts((s) => { const n = new Set(s); mode === "hide" ? n.add(id) : n.delete(id); return n; });
  };
  const toggleFeature = (id: string) => setFeatured((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
  const toggleCollection = (id: string) =>
    setAllowedCollections((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = () =>
    start(async () => {
      const res = await saveCatalogVisibility({
        allowedCollections: [...allowedCollections],
        allowedProducts: [...allowedProducts],
        hiddenProducts: [...hiddenProducts],
        featured,
        order: [],
      });
      toast(res.message, res.ok ? "success" : "error");
    });

  return (
    <div className="space-y-4">
      {/* Summary + save */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="success" className="gap-1"><Eye className="size-3" /> {visibleCount} visible to affiliates</Badge>
        <span className="text-sm text-muted-foreground">of {products.length} live products{capped ? "+" : ""}</span>
        <Button className="ml-auto" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save catalog
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {(["collections", "products"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${tab === t ? "bg-background text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "collections" ? `Collections (${allowedCollections.size} on)` : `Products (${visibleCount})`}
          </button>
        ))}
      </div>

      {tab === "collections" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Turn a collection on and <span className="font-medium text-foreground">every live product in it</span> becomes visible. Override individual products under the Products tab.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {collections.length === 0 && <p className="text-sm text-muted-foreground">No collections found in Shopify.</p>}
            {collections.map((c) => {
              const on = allowedCollections.has(c.id);
              return (
                <button key={c.id} onClick={() => toggleCollection(c.id)} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${on ? "border-primary bg-primary/5" : "border-hairline hover:border-primary/30"}`}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Layers className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">{c.productsCount} product{c.productsCount === 1 ? "" : "s"}</span>
                  </span>
                  <Badge variant={on ? "success" : "secondary"}>{on ? "Visible" : "Off"}</Badge>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={term} onChange={(e) => setTerm(e.target.value)} className="pl-9" placeholder={`Search all ${products.length} products…`} />
          </div>
          <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
            {shown.map((p) => {
              const mode = hiddenProducts.has(p.id) ? "hide" : allowedProducts.has(p.id) ? "show" : "auto";
              const vis = isVisible(p);
              const cols = p.collectionIds.map((id) => collById.get(id)?.title).filter(Boolean).slice(0, 3);
              const isFeat = featured.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.image ? <img src={p.image} alt="" className="size-11 shrink-0 rounded-lg object-cover" /> : <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Sparkles className="size-4" /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {p.title}
                      {!p.available && <span className="inline-flex items-center gap-0.5 text-[11px] text-danger"><PackageX className="size-3" /> Out</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.price ? `${p.currency ?? ""} ${p.price}` : "—"}{cols.length ? ` · ${cols.join(", ")}` : ""}
                    </p>
                  </div>
                  {/* feature */}
                  <button onClick={() => toggleFeature(p.id)} title="Feature first" className={`shrink-0 rounded-md p-1.5 transition-colors ${isFeat ? "text-gold" : "text-muted-foreground hover:text-gold"}`} aria-label="Feature">
                    <Star className={`size-4 ${isFeat ? "fill-current" : ""}`} />
                  </button>
                  {/* mode segmented */}
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-hairline text-xs">
                    {(["auto", "show", "hide"] as const).map((m) => (
                      <button key={m} onClick={() => setMode(p.id, m)} className={`px-2.5 py-1.5 capitalize transition-colors ${mode === m ? (m === "hide" ? "bg-danger text-white" : m === "show" ? "bg-success text-white" : "bg-foreground text-background") : "text-muted-foreground hover:bg-muted"}`}>
                        {m === "auto" ? "Auto" : m === "show" ? "Show" : "Hide"}
                      </button>
                    ))}
                  </div>
                  {/* effective */}
                  <span className="w-5 shrink-0 text-center" title={vis ? "Visible to affiliates" : "Hidden from affiliates"}>
                    {vis ? <Eye className="size-4 text-success" /> : <EyeOff className="size-4 text-muted-foreground" />}
                  </span>
                </div>
              );
            })}
          </div>
          {filtered.length > shown.length && <p className="text-center text-xs text-muted-foreground">Showing first {shown.length} of {filtered.length} — search to narrow.</p>}
          <p className="text-[11px] text-muted-foreground"><span className="font-medium">Auto</span> follows the product&apos;s collections · <span className="font-medium text-success">Show</span> forces it visible · <span className="font-medium text-danger">Hide</span> always wins.</p>
        </div>
      )}
    </div>
  );
}
