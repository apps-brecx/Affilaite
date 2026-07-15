"use client";

import { useState } from "react";
import { ShoppingBag, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function CatalogControlTab({
  productsPanel,
  collectionsPanel,
}: {
  productsPanel: React.ReactNode;
  collectionsPanel: React.ReactNode;
}) {
  const [view, setView] = useState<"products" | "collections">("products");

  const Seg = ({
    id,
    icon: Icon,
    children,
  }: {
    id: "products" | "collections";
    icon: typeof ShoppingBag;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => setView(id)}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        view === id ? "bg-background text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-hairline bg-muted/40 p-0.5">
        <Seg id="products" icon={ShoppingBag}>
          Products
        </Seg>
        <Seg id="collections" icon={Layers}>
          Collections
        </Seg>
      </div>
      {/* Keep both mounted so unsaved reordering survives switching views. */}
      <div className={view === "products" ? "" : "hidden"}>{productsPanel}</div>
      <div className={view === "collections" ? "" : "hidden"}>{collectionsPanel}</div>
    </div>
  );
}
