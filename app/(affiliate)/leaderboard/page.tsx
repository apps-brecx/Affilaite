import { Trophy, Flame } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { requireAffiliate } from "@/lib/session";
import { getLeaderboard, tierFor, nextTier } from "@/lib/leaderboard";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Leaderboard" };

export default async function LeaderboardPage() {
  const me = await requireAffiliate();
  const rows = await getLeaderboard(50);
  const mine = rows.find((r) => r.affiliateId === me.id);
  const myEarned = mine?.earned ?? 0;
  const myTier = mine?.tier ?? tierFor(0);
  const next = nextTier(myEarned);
  const progress = next ? Math.min(100, Math.round((myEarned / next.tier.min) * 100)) : 100;

  return (
    <div className="space-y-8">
      <PageHeader title="Leaderboard" description="See where you rank — climb the tiers, earn badges, win contests." />

      {/* Your standing */}
      <Card className="overflow-hidden">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{myTier.emoji}</span>
            <div>
              <p className={`font-display text-xl font-semibold ${myTier.color}`}>{myTier.name} tier</p>
              <p className="text-sm text-muted-foreground">
                {mine ? `Rank #${mine.rank} · ${mine.sales} sale${mine.sales === 1 ? "" : "s"} · ${formatCurrency(myEarned)} earned` : "Make your first sale to join the board!"}
              </p>
            </div>
          </div>
          {next && (
            <div className="w-full sm:max-w-xs">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                <span>To {next.tier.emoji} {next.tier.name}</span>
                <span>{formatCurrency(next.remaining)} to go</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your badges */}
      {mine && mine.badges.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {mine.badges.map((b) => (
            <span key={b.label} className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1.5 text-sm">
              <span>{b.emoji}</span> {b.label}
            </span>
          ))}
        </div>
      )}

      {/* The board */}
      <Card>
        <CardContent className="divide-y divide-hairline p-0">
          {rows.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No sales yet — be the first on the board!</p>}
          {rows.map((r) => {
            const isMe = r.affiliateId === me.id;
            return (
              <div key={r.affiliateId} className={`flex items-center gap-3 px-4 py-3 ${isMe ? "bg-primary/5" : ""}`}>
                <span className="w-8 shrink-0 text-center text-sm font-semibold tabular-nums text-muted-foreground">
                  {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
                </span>
                <Avatar name={r.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{isMe ? "You" : r.name} <span className="ml-1">{r.tier.emoji}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{r.sales} sale{r.sales === 1 ? "" : "s"} · {r.tier.name}</p>
                </div>
                {r.badges.slice(0, 3).map((b) => (
                  <span key={b.label} title={b.label} className="text-lg">{b.emoji}</span>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Flame className="size-3.5 text-primary" /> Tiers are based on your approved + paid earnings. Keep selling to climb!
      </p>
    </div>
  );
}
