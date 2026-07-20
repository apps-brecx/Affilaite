import { Crown, Gem, Sparkles, TrendingUp, PiggyBank } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAffiliate } from "@/lib/session";
import { getMyVip } from "@/lib/vip";

export const metadata = { title: "VIP" };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function VipPage() {
  const me = await requireAffiliate();
  const { connected, vip, error } = await getMyVip(me.email);

  if (!connected) {
    return (
      <div className="space-y-8">
        <PageHeader title="Syruvia VIP" description="Your VIP points and rewards." />
        <EmptyState icon={Crown} title="VIP isn't available yet" description="Once the store is connected, your VIP points will appear here." />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-8">
        <PageHeader title="Syruvia VIP" description="Your VIP points and rewards." />
        <EmptyState icon={Crown} title="Couldn't load your VIP status" description="Please try again in a moment." />
      </div>
    );
  }
  if (!vip.found) {
    return (
      <div className="space-y-8">
        <PageHeader title="Syruvia VIP" description="Your VIP points and rewards." />
        <EmptyState icon={Crown} title="Syruvia account not found" description={`We couldn't find a Syruvia customer account for ${me.email}. Sign up or order with this email to start earning VIP points.`} />
      </div>
    );
  }

  const points = vip.points ?? 0;
  const hasProgress = vip.nextTier && vip.pointsToNext != null && vip.pointsToNext > 0;
  const progressPct = hasProgress ? Math.max(4, Math.min(100, Math.round((points / (points + (vip.pointsToNext ?? 0))) * 100))) : 100;

  return (
    <div className="space-y-8">
      <PageHeader title="Syruvia VIP" description="Your VIP points, tier, and lifetime rewards — synced live from your Syruvia account." />

      {/* Hero: points + tier */}
      <Card className="overflow-hidden">
        <CardContent className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="aurora pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold ring-gilded">
              <Crown className="size-8" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Your VIP points</p>
              <p className="font-display text-4xl font-bold text-foreground">{points.toLocaleString()}</p>
              <div className="mt-1 flex items-center gap-2">
                {vip.tier && <Badge variant="gold" className="gap-1"><Gem className="size-3" /> {vip.tier}</Badge>}
                {vip.status && <Badge variant={vip.status.toLowerCase() === "active" ? "success" : "secondary"}>{vip.status}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress to next tier */}
      {hasProgress && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium"><TrendingUp className="size-4 text-primary" /> To {vip.nextTier}</span>
              <span className="text-muted-foreground">{vip.pointsToNext?.toLocaleString()} points to go</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
            <div>
              <p className="text-sm text-muted-foreground">Lifetime points earned</p>
              <p className="font-display text-2xl font-semibold">{(vip.lifetime ?? points).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        {vip.lifetimeSaved != null && (
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <span className="grid size-11 place-items-center rounded-xl bg-success-soft text-success"><PiggyBank className="size-5" /></span>
              <div>
                <p className="text-sm text-muted-foreground">Lifetime saved</p>
                <p className="font-display text-2xl font-semibold">{money(vip.lifetimeSaved)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">Points are synced from your Syruvia VIP account. Keep sipping &amp; sharing to earn more. 🎉</p>
    </div>
  );
}
