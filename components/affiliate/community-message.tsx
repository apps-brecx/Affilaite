"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Ticket, Rocket, Trophy, Megaphone, Check, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { voteInPoll, enterGiveaway, joinCampaignFromInvite } from "@/app/actions/messaging";
import { relativeTime } from "@/lib/utils";
import type { ChatMessage, LeaderRow } from "@/lib/messaging";

export function CommunityMessage({
  msg,
  leaderboard,
  myAffiliateId,
}: {
  msg: ChatMessage;
  leaderboard?: LeaderRow[];
  myAffiliateId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      if (res.message) toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  if (msg.kind === "announcement") {
    return (
      <div className="my-2 flex justify-center">
        <div className="max-w-md rounded-full bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <Megaphone className="mr-1 inline size-3.5" />{msg.body}
        </div>
      </div>
    );
  }

  const p = msg.payload ?? {};
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm bg-accent px-4 py-3 text-sm">
        {msg.kind === "deal" && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-primary"><Ticket className="size-4" /> {p.title || "Special deal"}</div>
            {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
            {p.code && (
              <button onClick={() => { navigator.clipboard?.writeText(p.code); toast("Code copied!"); }} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-background px-3 py-1 font-mono font-semibold tracking-wide">
                {p.code} <Copy className="size-3.5 opacity-60" />
              </button>
            )}
            {p.endsAt && <p className="text-xs text-muted-foreground">Ends {new Date(p.endsAt).toLocaleDateString()}</p>}
          </div>
        )}

        {msg.kind === "invite" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary"><Rocket className="size-4" /> Campaign invite</div>
            <p className="font-medium">{p.campaignName || "New campaign"}</p>
            {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
            <Button size="sm" disabled={pending} onClick={() => run(() => joinCampaignFromInvite(p.campaignId))}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />} Join campaign
            </Button>
          </div>
        )}

        {msg.kind === "giveaway" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary"><Gift className="size-4" /> Giveaway</div>
            {p.prize && <p className="font-medium">Prize: {p.prize}</p>}
            {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
            {msg.entered ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><Check className="size-3.5" /> You're entered — good luck!</span>
            ) : (
              <Button size="sm" variant="gold" disabled={pending} onClick={() => run(() => enterGiveaway(msg.id))}>
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Gift className="size-3.5" />} Enter giveaway
              </Button>
            )}
          </div>
        )}

        {msg.kind === "competition" && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary"><Trophy className="size-4" /> {p.title || "Competition"}</div>
            {p.prize && <p className="font-medium">🏆 {p.prize}</p>}
            {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
            {p.endsAt && <p className="text-xs text-muted-foreground">Ends {new Date(p.endsAt).toLocaleDateString()}</p>}
            {leaderboard && leaderboard.length > 0 && (
              <div className="space-y-1 border-t border-hairline pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leaderboard</p>
                {leaderboard.slice(0, 5).map((r) => (
                  <div key={r.affiliateId} className={`flex items-center justify-between rounded px-1.5 py-0.5 text-xs ${r.affiliateId === myAffiliateId ? "bg-primary/10 font-semibold" : ""}`}>
                    <span>{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `${r.rank}.`} {r.affiliateId === myAffiliateId ? "You" : r.name}</span>
                    <span className="font-mono">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {msg.poll && msg.kind !== "giveaway" && (
          <div className="space-y-1.5">
            <p className="font-medium">📊 {msg.poll.question}</p>
            {msg.poll.options.map((o, i) => {
              const voted = msg.myVote != null;
              const pct = msg.poll!.totalVotes ? Math.round((o.votes / msg.poll!.totalVotes) * 100) : 0;
              return voted ? (
                <div key={i} className={`relative overflow-hidden rounded-md border ${msg.myVote === i ? "border-primary" : "border-hairline"}`}>
                  <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
                  <div className="relative flex justify-between px-2.5 py-1.5 text-xs"><span>{o.text}{msg.myVote === i && " ✓"}</span><span className="font-medium text-muted-foreground">{pct}%</span></div>
                </div>
              ) : (
                <button key={i} disabled={pending} onClick={() => run(() => voteInPoll(msg.id, i))} className="block w-full rounded-md border border-hairline px-2.5 py-1.5 text-left text-xs hover:border-primary hover:bg-primary/5">{o.text}</button>
              );
            })}
            <p className="text-xs text-muted-foreground">{msg.poll.totalVotes} vote{msg.poll.totalVotes === 1 ? "" : "s"}</p>
          </div>
        )}

        {msg.body && !["deal", "invite", "giveaway", "competition"].includes(msg.kind) && (
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        )}
        {msg.attachments?.map((a, i) => (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-primary underline">📎 {a.name || a.url}</a>
        ))}
      </div>
      <span className="pl-1 text-[10px] text-muted-foreground">{relativeTime(msg.createdAt)}</span>
    </div>
  );
}
