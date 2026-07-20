"use client";

import { useMemo, useState } from "react";
import { ShoppingBag, PackageOpen, ChevronDown, Layers, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";

export interface CatalogItem {
  id: string;
  title: string;
  image: string | null;
  price: string | null;
  currency: string | null;
  available: boolean;
  shareLink: string;
  collectionIds?: string[];
}

export interface CollectionItem {
  id: string;
  title: string;
  image: string | null;
  productsCount: number;
  shareLink: string;
}

export function CatalogBrowser({
  products,
  collections,
  filterCollections = [],
  defaultOpen = true,
}: {
  products: CatalogItem[];
  collections: CollectionItem[];
  filterCollections?: { id: string; title: string }[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<"products" | "collections">(products.length ? "products" : "collections");
  const [q, setQ] = useState("");
  const [colFilter, setColFilter] = useState<string | null>(null);
  const showTabs = products.length > 0 && collections.length > 0;
  const active = view === "collections" && collections.length ? "collections" : products.length ? "products" : "collections";

  const term = q.trim().toLowerCase();
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (!term || p.title.toLowerCase().includes(term)) &&
          (!colFilter || (p.collectionIds ?? []).includes(colFilter)),
      ),
    [products, term, colFilter],
  );
  const filteredCollections = useMemo(
    () => (term ? collections.filter((c) => c.title.toLowerCase().includes(term)) : collections),
    [collections, term],
  );

  const summary = [
    products.length ? `${products.length} product${products.length === 1 ? "" : "s"}` : "",
    collections.length ? `${collections.length} collection${collections.length === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <ShoppingBag className="size-4" /> Catalog
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{summary}</Badge>
          <Button variant="secondary" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide catalog" : "See catalog"}
            <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      {!open ? (
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
          className="flex cursor-pointer flex-col items-center gap-2 border-dashed py-10 text-center transition-colors hover:bg-accent/40"
        >
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </span>
          <p className="font-medium">Browse the catalog</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {summary} ready to share — each with your referral link baked in. Tap to open.
          </p>
          <Button size="sm" className="mt-1">
            See catalog <ChevronDown className="size-4" />
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Tabs + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {showTabs ? (
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-hairline bg-muted/40 p-0.5">
                <button
                  onClick={() => setView("products")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active === "products" ? "bg-background text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <PackageOpen className="size-4" /> Products
                </button>
                <button
                  onClick={() => setView("collections")}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active === "collections" ? "bg-background text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Layers className="size-4" /> Collections
                </button>
              </div>
            ) : (
              <span />
            )}
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search ${active}…`}
                className="h-9 pl-9"
              />
            </div>
          </div>

          {/* Collection filter chips (products view) */}
          {active === "products" && filterCollections.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setColFilter(null)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${!colFilter ? "border-primary bg-primary/10 text-primary" : "border-hairline text-muted-foreground hover:text-foreground"}`}
              >
                All
              </button>
              {filterCollections.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColFilter((cur) => (cur === c.id ? null : c.id))}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${colFilter === c.id ? "border-primary bg-primary/10 text-primary" : "border-hairline text-muted-foreground hover:text-foreground"}`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}

          {active === "collections" ? (
            filteredCollections.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No collections match &ldquo;{q}&rdquo;.</p>
            ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredCollections.map((c) => (
                <Card key={c.id} className="group flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
                  <a href={c.shareLink} target="_blank" rel="noopener noreferrer" className="relative block aspect-[16/10] bg-muted">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt={c.title} className="size-full object-cover transition-transform group-hover:scale-105" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-muted-foreground">
                        <Layers className="size-7" />
                      </span>
                    )}
                  </a>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="flex-1">
                      <p className="truncate text-sm font-medium leading-snug">{c.title}</p>
                      {c.productsCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {c.productsCount} product{c.productsCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    <CopyButton value={c.shareLink} variant="outline" label="Copy share link" className="w-full text-xs" />
                  </div>
                </Card>
              ))}
            </div>
            )
          ) : filteredProducts.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No products match &ldquo;{q}&rdquo;.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="group flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
                  <div className="relative aspect-square bg-muted">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.image} alt={product.title} className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <PackageOpen className="size-8" />
                      </div>
                    )}
                    {!product.available && (
                      <span className="absolute left-2 top-2 rounded-md bg-background/90 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Out of stock
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <p className="line-clamp-2 flex-1 text-sm font-medium leading-snug">{product.title}</p>
                    {product.price && (
                      <p className="text-sm font-semibold text-foreground">
                        {product.currency === "USD" ? "$" : ""}
                        {product.price}
                        {product.currency && product.currency !== "USD" ? ` ${product.currency}` : ""}
                      </p>
                    )}
                    <CopyButton value={product.shareLink} variant="outline" label="Copy share link" className="w-full text-xs" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
