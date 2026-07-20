"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function CampaignTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/admin/campaigns/${id}`;
  const tabs = [
    { label: "Overview", href: base },
    { label: "Affiliates", href: `${base}/affiliates` },
    { label: "Rewards & rules", href: `${base}/rewards` },
    { label: "Settings", href: `${base}/settings` },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-hairline no-scrollbar">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
