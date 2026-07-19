import Link from "next/link";
import { eq } from "drizzle-orm";
import { ArrowLeft, MessageSquare, Lock, Globe } from "lucide-react";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { Avatar } from "@/components/ui/avatar";
import { GroupAvatar } from "@/components/ui/group-avatar";
import { NewGroupButton } from "@/components/admin/new-group-button";
import { GroupManage } from "@/components/admin/group-manage";
import { MessageComposer } from "@/components/admin/message-composer";
import { AdminChatMessage } from "@/components/admin/chat-message";
import { MarkDmRead } from "@/components/admin/mark-dm-read";
import {
  listGroupsAdmin,
  listDmThreads,
  getGroupThreadAdmin,
  getGroupMembers,
  listAddableAffiliates,
  getDmThread,
  competitionLeaderboard,
  type LeaderRow,
} from "@/lib/messaging";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Messages & Groups" };

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; g?: string; dm?: string }>;
}) {
  const { tab = "groups", g, dm } = await searchParams;
  const [groups, dmThreads, camps] = await Promise.all([
    listGroupsAdmin(),
    listDmThreads(),
    db ? db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns).where(eq(campaigns.status, "active")) : Promise.resolve([]),
  ]);

  const selected = g || dm;
  const activeTab = dm ? "direct" : tab;

  const group = g ? groups.find((x) => x.id === g) : undefined;
  const [thread, members, addable] = g
    ? await Promise.all([getGroupThreadAdmin(g), getGroupMembers(g), listAddableAffiliates(g)])
    : [[], [], []];
  const leaderboards: Record<string, LeaderRow[]> = {};
  for (const m of thread) {
    if (m.kind === "competition") {
      leaderboards[m.id] = await competitionLeaderboard(m.payload?.startsAt ?? null, m.payload?.endsAt ?? null, m.payload?.metric ?? "sales");
    }
  }

  const dmThread = dm ? dmThreads.find((t) => t.affiliateId === dm) : undefined;
  const dmMsgs = dm ? await getDmThread(dm, "admin") : [];

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] min-h-[540px] overflow-hidden rounded-2xl border border-hairline bg-card">
      {/* Rail */}
      <aside className={`${selected ? "hidden lg:flex" : "flex"} w-full flex-col border-r border-hairline lg:w-[340px]`}>
        <div className="flex items-center justify-between gap-2 border-b border-hairline p-4">
          <h1 className="font-display text-lg font-semibold">Messages</h1>
          <NewGroupButton />
        </div>
        <div className="flex gap-1 border-b border-hairline p-2">
          {(["groups", "direct"] as const).map((t) => (
            <Link key={t} href={`/admin/messages?tab=${t}`} className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium capitalize ${activeTab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"}`}>
              {t === "direct" ? "Direct" : "Groups"}
            </Link>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {activeTab === "groups"
            ? groups.map((gr) => (
                <Link key={gr.id} href={`/admin/messages?tab=groups&g=${gr.id}`} className={`flex items-center gap-3 border-b border-hairline/60 px-4 py-3 hover:bg-accent ${g === gr.id ? "bg-accent" : ""}`}>
                  <GroupAvatar emoji={gr.avatarEmoji} color={gr.avatarColor} imageUrl={gr.imageUrl} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{gr.name}</p>
                      {gr.isMain ? null : gr.visibility === "public" ? <Globe className="size-3 text-muted-foreground" /> : <Lock className="size-3 text-muted-foreground" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{gr.lastMessage?.preview ?? `${gr.memberCount} members`}</p>
                  </div>
                  {gr.lastMessage && <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(gr.lastMessage.createdAt)}</span>}
                </Link>
              ))
            : dmThreads.map((t) => (
                <Link key={t.affiliateId} href={`/admin/messages?dm=${t.affiliateId}`} className={`flex items-center gap-3 border-b border-hairline/60 px-4 py-3 hover:bg-accent ${dm === t.affiliateId ? "bg-accent" : ""}`}>
                  <Avatar name={t.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.lastMessage ? `${t.lastMessage.fromAdmin ? "You: " : ""}${t.lastMessage.preview}` : "Start a conversation"}</p>
                  </div>
                  {t.unread > 0 && <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{t.unread}</span>}
                </Link>
              ))}
        </div>
      </aside>

      {/* Main pane */}
      <main className={`${selected ? "flex" : "hidden lg:flex"} flex-1 flex-col`}>
        {group ? (
          <>
            <header className="flex items-center gap-3 border-b border-hairline p-3">
              <Link href="/admin/messages?tab=groups" className="lg:hidden"><ArrowLeft className="size-5" /></Link>
              <GroupAvatar emoji={group.avatarEmoji} color={group.avatarColor} imageUrl={group.imageUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{group.name}</p>
                <p className="text-xs text-muted-foreground">{group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.visibility}</p>
              </div>
              <GroupManage group={group} members={members} addable={addable} />
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {thread.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Send the first one below.</p>}
              {thread.map((m) => <AdminChatMessage key={m.id} msg={m} leaderboard={leaderboards[m.id]} />)}
            </div>
            <MessageComposer target={{ type: "group", id: group.id }} campaigns={camps} />
          </>
        ) : dmThread ? (
          <>
            <MarkDmRead affiliateId={dmThread.affiliateId} />
            <header className="flex items-center gap-3 border-b border-hairline p-3">
              <Link href="/admin/messages?tab=direct" className="lg:hidden"><ArrowLeft className="size-5" /></Link>
              <Avatar name={dmThread.name} size={40} />
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{dmThread.name}</p><p className="text-xs text-muted-foreground">{dmThread.email}</p></div>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {dmMsgs.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No messages yet. Say hi or send a deal below.</p>}
              {dmMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.fromAdmin ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${m.fromAdmin ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-accent"}`}>
                    {m.kind === "deal" && <p className="mb-0.5 text-xs font-semibold opacity-80">🎟️ Deal{m.payload?.code ? ` · ${m.payload.code}` : ""}</p>}
                    {m.kind === "invite" && <p className="mb-0.5 text-xs font-semibold opacity-80">🚀 Invite · {m.payload?.campaignName}</p>}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 text-right text-[10px] ${m.fromAdmin ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{relativeTime(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
            <MessageComposer target={{ type: "dm", id: dmThread.affiliateId }} campaigns={camps} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <MessageSquare className="size-10 opacity-40" />
            <p className="text-sm">Select a group or a partner to start messaging.</p>
          </div>
        )}
      </main>
    </div>
  );
}
