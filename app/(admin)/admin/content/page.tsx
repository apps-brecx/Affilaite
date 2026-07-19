import { ExternalLink, Instagram, Music2, Youtube, Twitter, Facebook, Link2, MoonStar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { NudgeButton } from "@/components/admin/nudge-button";
import { listRecentPosts, quietAffiliates } from "@/lib/social";

export const metadata = { title: "Content" };

const ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  tiktok: Music2,
  youtube: Youtube,
  x: Twitter,
  facebook: Facebook,
  other: Link2,
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default async function ContentPage() {
  const [posts, quiet] = await Promise.all([listRecentPosts(80), quietAffiliates(14)]);

  return (
    <div className="space-y-8">
      <PageHeader title="Content feed" description="Every post your affiliates have shared — and who's gone quiet and could use a nudge." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent posts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {posts.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">No posts logged yet. Affiliates can add posts from their portal.</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {posts.map((p) => {
                  const Icon = ICONS[p.platform] ?? Link2;
                  return (
                    <li key={p.id} className="flex items-center gap-3 px-6 py-3">
                      <Avatar name={p.affiliateName ?? "Partner"} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.affiliateName}</p>
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground hover:text-primary">
                          <Icon className="size-3.5 shrink-0" />
                          <span className="truncate">{p.url.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmt(p.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Gone quiet */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MoonStar className="size-4 text-primary" /> Gone quiet
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {quiet.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-muted-foreground">Everyone&apos;s active — nice! 🎉</p>
            ) : (
              <ul className="divide-y divide-hairline">
                {quiet.slice(0, 20).map((a) => (
                  <li key={a.affiliateId} className="flex items-center gap-3 px-6 py-3">
                    <Avatar name={a.name} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.lastPostAt ? `Last posted ${fmt(a.lastPostAt)}` : "Never posted"}</p>
                    </div>
                    <NudgeButton affiliateId={a.affiliateId} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
