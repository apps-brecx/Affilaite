"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Save, Search, Check, Heart, ExternalLink, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveMyFavorites } from "@/app/actions/favorites";
import type { StoreProduct } from "@/lib/products";

export function FavoritesPicker({
  products,
  initialSelected,
  connected,
  collectionUrl: initialUrl,
}: {
  products: StoreProduct[];
  initialSelected: string[];
  connected: boolean;
  collectionUrl: string | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [q, setQ] = useState("");
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [pending, start] = useTransition();
  const toast = useToast();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? products.filter((p) => p.title.toLowerCase().includes(s)) : products;
  }, [q, products]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await saveMyFavorites([...selected]);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok && res.collectionUrl) setUrl(res.collectionUrl);
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-4 text-primary" /> Shop my Favorites
        </CardTitle>
        <div className="flex items-center gap-2">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-1.5 text-xs font-medium hover:border-primary/40 hover:text-primary">
              View collection <ExternalLink className="size-3.5" />
            </a>
          )}
          <Button size="sm" onClick={save} disabled={pending || !connected}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save favorites
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="-mt-2 text-sm text-muted-foreground">
          Pick the products you love. We build them into your own Shopify collection — your page&apos;s
          <strong> Shop my favorites</strong> button sends shoppers straight there, with your code auto-applied.
        </p>

        {!connected ? (
          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
            <ShoppingBag className="size-4" /> Connect your Shopify store to build a favorites collection.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="pl-9" />
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">{selected.size} selected</span>
            </div>

            {products.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No products found in your store yet.</p>
            ) : (
              <div className="grid max-h-[460px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p) => {
                  const on = selected.has(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggle(p.id)}
                      className={`group relative overflow-hidden rounded-xl border text-left transition-colors ${on ? "border-primary ring-1 ring-primary" : "border-hairline hover:border-primary/40"}`}>
                      <div className="aspect-square w-full bg-muted">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground"><ShoppingBag className="size-6" /></span>
                        )}
                      </div>
                      <span className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-hairline bg-background/80 text-transparent"}`}>
                        <Check className="size-3.5" />
                      </span>
                      <div className="p-2">
                        <p className="line-clamp-2 text-xs font-medium">{p.title}</p>
                        {p.price && <p className="mt-0.5 text-[11px] text-muted-foreground">{p.currency === "USD" ? "$" : ""}{p.price}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
