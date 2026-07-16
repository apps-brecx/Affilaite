"use client";

import { useState, useTransition } from "react";
import { Gift, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestSample } from "@/app/actions/affiliate";
import type { StoreProduct } from "@/lib/products";

export function SampleCatalog({ products, openProductIds }: { products: StoreProduct[]; openProductIds: string[] }) {
  const [done, setDone] = useState<Set<string>>(new Set(openProductIds));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();
  const toast = useToast();

  const request = (p: StoreProduct) => {
    setPendingId(p.id);
    start(async () => {
      const res = await requestSample({
        productId: p.id,
        productTitle: p.title,
        productImage: p.image ?? undefined,
        productUrl: p.url,
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) setDone((prev) => new Set(prev).add(p.id));
      setPendingId(null);
    });
  };

  if (!products.length) {
    return <p className="text-sm text-muted-foreground">No products are available to sample yet — check back soon.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => {
        const requested = done.has(p.id);
        const outOfStock = p.available === false;
        return (
          <div key={p.id} className={`overflow-hidden rounded-xl border border-hairline bg-card ${outOfStock ? "opacity-70" : ""}`}>
            <div className="relative flex aspect-square items-center justify-center bg-muted">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={p.title} className="size-full object-cover" />
              ) : (
                <Gift className="size-8 text-muted-foreground" />
              )}
              {outOfStock && (
                <span className="absolute left-2 top-2 rounded-full bg-danger px-2 py-0.5 text-[10px] font-semibold text-danger-foreground">
                  Out of stock
                </span>
              )}
            </div>
            <div className="space-y-2 p-3">
              <p className="truncate text-sm font-medium" title={p.title}>{p.title}</p>
              <Button size="sm" className="w-full" disabled={requested || outOfStock || pendingId === p.id} onClick={() => request(p)}>
                {outOfStock ? (
                  "Out of stock"
                ) : requested ? (
                  <><Check className="size-4" /> Requested</>
                ) : pendingId === p.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Request sample"
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
