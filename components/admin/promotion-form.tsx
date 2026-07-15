"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Zap, Search, PackageOpen, X, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createPromotion } from "@/app/actions/admin";
import type { StoreProduct } from "@/lib/products";
import { cn } from "@/lib/utils";

export function PromotionForm({ products = [] }: { products?: StoreProduct[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const [picked, setPicked] = useState<StoreProduct | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => products.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase())),
    [products, q],
  );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createPromotion({
        name: String(fd.get("name") ?? ""),
        bonusType: "percent",
        bonusValue: String(fd.get("bonusValue") ?? ""),
        startsAt: String(fd.get("startsAt") ?? ""),
        endsAt: String(fd.get("endsAt") ?? ""),
        productId: picked?.id ?? "",
        productTitle: picked?.title ?? "",
        productImage: picked?.image ?? "",
        productUrl: picked?.url ?? "",
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        form.reset();
        setPicked(null);
        router.refresh();
      }
    });
  };

  return (
    <Card className="h-fit border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Plus className="size-4" /> New promotion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Black Friday Boost" />
          </div>
          <div className="space-y-1.5">
            <Label>Bonus %</Label>
            <Input name="bonusValue" type="number" step="0.1" required placeholder="5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input name="startsAt" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input name="endsAt" type="date" required />
            </div>
          </div>

          {/* Featured product */}
          <div className="space-y-1.5">
            <Label>Featured product (optional)</Label>
            {picked ? (
              <div className="flex items-center gap-3 rounded-lg border border-hairline p-2">
                <span className="size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                  {picked.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={picked.image} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-muted-foreground">
                      <PackageOpen className="size-4" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{picked.title}</span>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setPicked(null)} title="Remove">
                  <X className="size-4" />
                </Button>
              </div>
            ) : products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-hairline px-3 py-2.5 text-xs text-muted-foreground">
                Connect Shopify to feature a product with the offer.
              </p>
            ) : (
              <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setPickerOpen((v) => !v)}>
                <ShoppingBag className="size-4" /> Choose from catalog
              </Button>
            )}

            {pickerOpen && !picked && products.length > 0 && (
              <div className="space-y-2 rounded-lg border border-hairline p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="h-9 pl-8" />
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {filtered.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No matches.</p>}
                  {filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPicked(p);
                        setPickerOpen(false);
                        setQ("");
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md border border-transparent p-1.5 text-left transition-colors hover:bg-accent",
                      )}
                    >
                      <span className="size-9 shrink-0 overflow-hidden rounded-md bg-muted">
                        {p.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.image} alt="" className="size-full object-cover" />
                        ) : (
                          <span className="flex size-full items-center justify-center text-muted-foreground">
                            <PackageOpen className="size-4" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.title}</span>
                        {p.price && (
                          <span className="block text-xs text-muted-foreground">
                            {p.currency === "USD" ? "$" : ""}
                            {p.price}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Launch promotion
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
