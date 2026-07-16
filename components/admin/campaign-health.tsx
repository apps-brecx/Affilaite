import { CheckCircle2, Circle, HeartPulse } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/lib/types";

export function CampaignHealth({ campaign, memberCount }: { campaign: Campaign; memberCount: number }) {
  const cfg = campaign.config;
  const checks = [
    { label: "Reward configured", done: cfg.reward.kind === "custom" ? !!cfg.reward.custom : cfg.reward.value > 0 },
    { label: "Signup link set", done: !!campaign.slug },
    { label: "Short code set", done: !!campaign.shortCode },
    { label: "Friend offer set", done: cfg.friend.kind === "none" ? true : cfg.friend.kind === "promo" ? !!cfg.friend.promoUrl : cfg.friend.value > 0 },
    { label: "Start date set", done: !!campaign.startsAt },
    { label: "Payout method chosen", done: !!cfg.payout.mode },
    { label: "Has members", done: memberCount > 0 },
    { label: "Description added", done: !!campaign.description },
  ];
  const done = checks.filter((c) => c.done).length;
  const pct = Math.round((done / checks.length) * 100);
  const tone = pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-danger";
  const bar = pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="size-4 text-primary" /> Campaign health
        </CardTitle>
        <span className={cn("font-display text-lg font-semibold", tone)}>{pct}%</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
        </div>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2 text-sm">
              {c.done ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Circle className="size-4 text-muted-foreground/50" />
              )}
              <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
