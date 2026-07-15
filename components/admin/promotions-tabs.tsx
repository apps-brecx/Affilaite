"use client";

import { useState } from "react";
import { BadgePercent, ShoppingBag, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function PromotionsTabs({
  promotionsPanel,
  catalogPanel,
  collectionsPanel,
}: {
  promotionsPanel: React.ReactNode;
  catalogPanel: React.ReactNode;
  collectionsPanel: React.ReactNode;
}) {
  const [tab, setTab] = useState<"promotions" | "catalog" | "collections">("promotions");

  const TabButton = ({
    id,
    icon: Icon,
    children,
  }: {
    id: "promotions" | "catalog" | "collections";
    icon: typeof BadgePercent;
    children: React.ReactNode;
  }) => (
    <button
      onClick={() => setTab(id)}
      className={cn(
        "-mb-px flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors",
        tab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-6 border-b border-hairline">
        <TabButton id="promotions" icon={BadgePercent}>
          Promotions
        </TabButton>
        <TabButton id="catalog" icon={ShoppingBag}>
          Products
        </TabButton>
        <TabButton id="collections" icon={Layers}>
          Collections
        </TabButton>
      </div>
      {tab === "promotions" ? promotionsPanel : tab === "catalog" ? catalogPanel : collectionsPanel}
    </div>
  );
}
