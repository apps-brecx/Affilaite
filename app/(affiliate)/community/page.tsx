import Link from "next/link";
import { ArrowLeft, MessageSquare, Compass, Users, Lock, Globe } from "lucide-react";
import { GroupAvatar } from "@/components/ui/group-avatar";
import { CommunityMessage } from "@/components/affiliate/community-message";
import { JoinGroupButton, LeaveGroupButton, DmReply, MarkGroupRead, MarkDmRead } from "@/components/affiliate/community-actions";
import { requireAffiliate } from "@/lib/session";
import {
  listGroupsForAffiliate,
  getGroupThreadForAffiliate,
  getDmThread,
  competitionLeaderboard,
  type LeaderRow,
} from "@/lib/messaging";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Community" };

const BRAND = "The Sipfluence Team";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ g?: string; dm?: string }>;
}) {
  const me = await requireAffiliate();
  const { g, dm } = await searchParams;
  const [{ joined, discover }, dmMsgs] = await Promise.all([
    listGroupsForAffiliate(me.id),
    getDmThread(me.id, "affiliate"),
  ]);
  const dmUnread = dmMsgs.filter((m) => m.fromAdmin && !m.seenByAffiliate).length;
  const selected = g || dm;

  const group = g ? [...joined, ...discover].find((x) => x.id === g) : undefined;
  const isMember = group ? joined.some((x) => x.id === group.id) : false;
  const thread = g && isMember ? await getGroupThreadForAffiliate(g, me.id) : [];
  const leaderboards: Record<string, LeaderRow[]> = {};
  for (const m of thread ?? []) {
    if (m.kind === "competition") leaderboards[m.id] = await competitionLeaderboard(m.payload?.startsAt ?? null, m.payload?.endsAt ?? null, m.payload?.metric ?? "sales");
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[540px] overflow-hidden rounded-2xl border border-hairline bg-card">
      {/* Rail */}
      <aside className={`${selected ? "hidden lg:flex" : "flex"} w-full flex-col border-r border-hairline lg:w-[320px]`}>
        <div className="border-b border-hairline p-4"><h1 className="font-display text-lg font-semibold">Community</h1></div>
        <div className="flex-1 overflow-y-auto">
          {/* Brand DM */}
          <Link href="/community?dm=1" className={`flex items-center gap-3 border-b border-hairline/60 px-4 py-3 hover:bg-accent ${dm ? "bg-accent" : ""}`}>
            <GroupAvatar emoji="💗" color="rose" size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{BRAND}</p>
              <p className="truncate text-xs text-muted-foreground">{dmMsgs.length ? dmMsgs[dmMsgs.length - 1].body ?? "Tap to view" : "Message the team directly"}</p>
            </div>
            {dmUnread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{dmUnread}</span>}
          </Link>

          {/* Your groups */}
          <p className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your groups</p>
          {joined.map((gr) => (
            <Link key={gr.id} href={`/community?g=${gr.id}`} className={`flex items-center gap-3 border-b border-hairline/60 px-4 py-3 hover:bg-accent ${g === gr.id ? "bg-accent" : ""}`}>
              <GroupAvatar emoji={gr.avatarEmoji} color={gr.avatarColor} imageUrl={gr.imageUrl} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{gr.name}</p>
                <p className="truncate text-xs text-muted-foreground">{gr.lastMessage?.preview ?? `${gr.memberCount} members`}</p>
              </div>
              {gr.unread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{gr.unread}</span>}
            </Link>
          ))}

          {/* Discover */}
          {discover.length > 0 && (
            <>
              <p className="flex items-center gap-1.5 px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Compass className="size-3.5" /> Discover</p>
              {discover.map((gr) => (
                <div key={gr.id} className="flex items-center gap-3 border-b border-hairline/60 px-4 py-3">
                  <GroupAvatar emoji={gr.avatarEmoji} color={gr.avatarColor} imageUrl={gr.imageUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{gr.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{gr.description || `${gr.memberCount} members`}</p>
                  </div>
                  <JoinGroupButton groupId={gr.id} />
                </div>
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Main pane */}
      <main className={`${selected ? "flex" : "hidden lg:flex"} flex-1 flex-col`}>
        {group ? (
          isMember ? (
            <>
              <MarkGroupRead groupId={group.id} />
              <header className="flex items-center gap-3 border-b border-hairline p-3">
                <Link href="/community" className="lg:hidden"><ArrowLeft className="size-5" /></Link>
                <GroupAvatar emoji={group.avatarEmoji} color={group.avatarColor} imageUrl={group.imageUrl} size={40} />
                <div className="min-w-0 flex-1"><p className="truncate font-semibold">{group.name}</p><p className="text-xs text-muted-foreground">{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</p></div>
                {!group.isMain && <LeaveGroupButton groupId={group.id} />}
              </header>
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {(thread ?? []).length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet — check back soon.</p>}
                {(thread ?? []).map((m) => <CommunityMessage key={m.id} msg={m} leaderboard={leaderboards[m.id]} myAffiliateId={me.id} />)}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <GroupAvatar emoji={group.avatarEmoji} color={group.avatarColor} imageUrl={group.imageUrl} size={64} />
              <div><p className="font-semibold">{group.name}</p><p className="text-sm text-muted-foreground">{group.description || `${group.memberCount} members`}</p></div>
              <JoinGroupButton groupId={group.id} />
            </div>
          )
        ) : dm ? (
          <>
            <MarkDmRead />
            <header className="flex items-center gap-3 border-b border-hairline p-3">
              <Link href="/community" className="lg:hidden"><ArrowLeft className="size-5" /></Link>
              <GroupAvatar emoji="💗" color="rose" size={40} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{BRAND}</p><p className="text-xs text-muted-foreground">Your private line to the team</p></div>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {dmMsgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hello 👋</p>}
              {dmMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.fromAdmin ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.fromAdmin ? "rounded-tl-sm bg-accent" : "rounded-tr-sm bg-primary text-primary-foreground"}`}>
                    {m.kind === "deal" && <p className="mb-0.5 text-xs font-semibold opacity-80">🎟️ Deal{m.payload?.code ? ` · ${m.payload.code}` : ""}</p>}
                    {m.kind === "invite" && <p className="mb-0.5 text-xs font-semibold opacity-80">🚀 Invite · {m.payload?.campaignName}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${m.fromAdmin ? "text-muted-foreground" : "text-primary-foreground/60"}`}>{relativeTime(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
            <DmReply />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <MessageSquare className="size-10 opacity-40" />
            <p className="text-sm">Select a group or message the team.</p>
          </div>
        )}
      </main>
    </div>
  );
}
