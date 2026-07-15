import Link from "next/link";
import {
  Bell,
  LayoutDashboard,
  Link2,
  BadgePercent,
  BarChart3,
  Wallet,
  Images,
  UsersRound,
  ArrowRight,
} from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAffiliate } from "@/lib/session";
import { listNotifications } from "@/lib/notifications";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Notifications" };

const SECTION_META: Record<string, { label: string; icon: typeof Bell }> = {
  dashboard: { label: "Dashboard", icon: LayoutDashboard },
  links: { label: "Links & Codes", icon: Link2 },
  promotions: { label: "Promotions", icon: BadgePercent },
  performance: { label: "Performance", icon: BarChart3 },
  payouts: { label: "Payouts", icon: Wallet },
  assets: { label: "Assets", icon: Images },
  community: { label: "Community", icon: UsersRound },
};

export default async function NotificationsPage() {
  const me = await requireAffiliate();
  const items = await listNotifications(me.id);

  return (
    <div className="space-y-8">
      <PageHeader title="Notifications" description="Everything new across your portal — commissions, payouts, offers, and messages." />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          description="New activity — approved commissions, payouts, promotions, and messages — will show up here."
        />
      ) : (
        <div className="mx-auto max-w-3xl space-y-3">
          {items.map((n) => {
            const meta = SECTION_META[n.section] ?? { label: "Update", icon: Bell };
            const Icon = meta.icon;
            const inner = (
              <CardContent className="flex items-start gap-3 p-4">
                <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                  {!n.read && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-danger ring-2 ring-card" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`font-medium ${n.read ? "" : "text-foreground"}`}>{n.title}</p>
                    <Badge variant="muted">{meta.label}</Badge>
                    {!n.read && <Badge variant="warning">New</Badge>}
                  </div>
                  {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{relativeTime(n.createdAt)}</p>
                </div>
                {n.href && <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />}
              </CardContent>
            );
            return n.href ? (
              <Link key={n.id} href={n.href} className="block">
                <Card className={`transition-shadow hover:shadow-lift ${n.read ? "" : "border-primary/20 bg-primary/[0.02]"}`}>
                  {inner}
                </Card>
              </Link>
            ) : (
              <Card key={n.id} className={n.read ? "" : "border-primary/20 bg-primary/[0.02]"}>
                {inner}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
