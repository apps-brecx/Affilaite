"use client";

import { useState } from "react";
import { ShoppingBag, PackageOpen, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

export interface CatalogItem {
  id: string;
  title: string;
  image: string | null;
  price: string | null;
  currency: string | null;
  available: boolean;
  shareLink: string;
}

export function CatalogBrowser({ products }: { products: CatalogItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <ShoppingBag className="size-4" /> Product catalog
        </h2>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{products.length} products</Badge>
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
          <p className="font-medium">Browse the product catalog</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {products.length} products ready to share — each with your referral link baked in. Tap to open.
          </p>
          <Button size="sm" className="mt-1">
            See catalog <ChevronDown className="size-4" />
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
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
    </section>
  );
}
