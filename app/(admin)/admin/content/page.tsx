import { ExternalLink, Instagram, Music2, Youtube, Twitter, Facebook, Link2, MoonStar, Sparkles, Play, Image as ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { NudgeButton } from "@/components/admin/nudge-button";
import { ScanNowButton } from "@/components/admin/scan-now-button";
import { DiscoveredActions } from "@/components/admin/discovered-actions";
import { listRecentPosts, quietAffiliates, listDiscoveredPosts } from "@/lib/social";

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
  const [posts, quiet, discovered] = await Promise.all([
    listRecentPosts(80),
    quietAffiliates(14),
    listDiscoveredPosts(60),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader title="Content feed" description="Posts your affiliates shared, brand content our AI worker found on their socials, and who's gone quiet." />
        <ScanNowButton />
      </div>

      {/* AI-discovered content */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> Discovered by AI
          </CardTitle>
          <span className="text-xs text-muted-foreground">Auto-scanned daily</span>
        </CardHeader>
        <CardContent className="p-0">
          {discovered.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              <p>No brand content discovered yet.</p>
              <p className="mx-auto mt-1 max-w-md text-xs">
                The worker checks each affiliate&apos;s public YouTube automatically. Instagram &amp; TikTok need a
                scraper provider connected (they block anonymous access) — until then, affiliates can still log posts
                from their portal. Hit <span className="font-medium">Scan now</span> to run it immediately.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-px bg-hairline sm:grid-cols-2">
              {discovered.map((d) => {
                const Icon = ICONS[d.platform] ?? Link2;
                return (
                  <li key={d.id} className="flex gap-3 bg-card p-4">
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {d.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.thumbnailUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          {d.mediaType === "video" ? <Play className="size-5" /> : <ImageIcon className="size-5" />}
                        </span>
                      )}
                    </a>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Avatar name={d.affiliateName} size={20} />
                        <span className="truncate text-xs font-medium">{d.affiliateName}</span>
                        <Badge variant="secondary" className="ml-auto gap-1 capitalize">
                          <Icon className="size-3" /> {d.platform}
                        </Badge>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-sm">{d.description || d.caption || "Brand content"}</p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          {d.postedAt ? fmt(d.postedAt) : "View"} <ExternalLink className="size-3" />
                        </a>
                        <DiscoveredActions id={d.id} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Posts affiliates shared</CardTitle>
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
