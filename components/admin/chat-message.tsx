"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Gift, Ticket, Rocket, Trophy, Megaphone, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { pickGiveawayWinner } from "@/app/actions/messaging";
import { relativeTime } from "@/lib/utils";
import type { ChatMessage, LeaderRow } from "@/lib/messaging";

export function AdminChatMessage({ msg, leaderboard }: { msg: ChatMessage; leaderboard?: LeaderRow[] }) {
  const [showReaders, setShowReaders] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const pickWinner = () =>
    start(async () => {
      const res = await pickGiveawayWinner(msg.id);
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });

  if (msg.kind === "announcement") {
    return (
      <div className="my-2 flex justify-center">
        <div className="max-w-md rounded-full bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <Megaphone className="mr-1 inline size-3.5" />
          {msg.body}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/10 px-4 py-3 text-sm">
        {msg.kind === "deal" && <DealCard msg={msg} />}
        {msg.kind === "invite" && <InviteCard msg={msg} />}
        {msg.kind === "giveaway" && <GiveawayCard msg={msg} pending={pending} onPick={pickWinner} />}
        {msg.kind === "competition" && <CompetitionCard msg={msg} leaderboard={leaderboard} />}
        {msg.poll && msg.kind !== "giveaway" && <PollView msg={msg} />}
        {msg.body && !["deal", "invite", "giveaway", "competition"].includes(msg.kind) && (
          <p className="whitespace-pre-wrap break-words">{msg.body}</p>
        )}
        {msg.attachments?.map((a, i) => (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-xs text-primary underline">
            📎 {a.name || a.url}
          </a>
        ))}
      </div>

      {/* Info: read receipts */}
      <div className="flex items-center gap-2 pr-1 text-xs text-muted-foreground">
        <span>{relativeTime(msg.createdAt)}</span>
        <button
          onClick={() => setShowReaders((v) => !v)}
          className="inline-flex items-center gap-1 hover:text-foreground"
          aria-label="See who read this"
        >
          <CheckCheck className={msg.readCount ? "size-3.5 text-sky-500" : "size-3.5"} />
          Seen by {msg.readCount}
        </button>
      </div>
      {showReaders && (
        <div className="max-w-[85%] rounded-lg border border-hairline bg-card p-2 text-xs text-muted-foreground">
          {msg.readers.length ? msg.readers.join(" · ") : "No one has opened this yet."}
        </div>
      )}
    </div>
  );
}

function DealCard({ msg }: { msg: ChatMessage }) {
  const p = msg.payload ?? {};
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-semibold text-primary"><Ticket className="size-4" /> {p.title || "Special deal"}</div>
      {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
      {p.code && <div className="mt-1 inline-block rounded-md border border-dashed border-primary/40 bg-background px-3 py-1 font-mono font-semibold tracking-wide">{p.code}</div>}
      {p.endsAt && <p className="text-xs text-muted-foreground">Ends {new Date(p.endsAt).toLocaleDateString()}</p>}
    </div>
  );
}

function InviteCard({ msg }: { msg: ChatMessage }) {
  const p = msg.payload ?? {};
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 font-semibold text-primary"><Rocket className="size-4" /> Campaign invite</div>
      <p className="font-medium">{p.campaignName || "New campaign"}</p>
      {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
      <p className="text-xs text-muted-foreground">Partners see a “Join” button.</p>
    </div>
  );
}

function GiveawayCard({ msg, pending, onPick }: { msg: ChatMessage; pending: boolean; onPick: () => void }) {
  const p = msg.payload ?? {};
  const entries = msg.poll?.totalVotes ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 font-semibold text-primary"><Gift className="size-4" /> Giveaway</div>
      {p.prize && <p className="font-medium">Prize: {p.prize}</p>}
      {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-hairline pt-2">
        <span className="text-xs text-muted-foreground">{entries} {entries === 1 ? "entry" : "entries"}</span>
        <Button size="sm" variant="gold" onClick={onPick} disabled={pending || entries === 0}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />} Pick winner
        </Button>
      </div>
    </div>
  );
}

function CompetitionCard({ msg, leaderboard }: { msg: ChatMessage; leaderboard?: LeaderRow[] }) {
  const p = msg.payload ?? {};
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 font-semibold text-primary"><Trophy className="size-4" /> {p.title || "Competition"}</div>
      {p.prize && <p className="font-medium">🏆 {p.prize}</p>}
      {msg.body && <p className="text-muted-foreground">{msg.body}</p>}
      {p.endsAt && <p className="text-xs text-muted-foreground">Ends {new Date(p.endsAt).toLocaleDateString()}</p>}
      {leaderboard && leaderboard.length > 0 && (
        <div className="space-y-1 border-t border-hairline pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live leaderboard</p>
          {leaderboard.slice(0, 5).map((r) => (
            <div key={r.affiliateId} className="flex items-center justify-between text-xs">
              <span>{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `${r.rank}.`} {r.name}</span>
              <span className="font-mono font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PollView({ msg }: { msg: ChatMessage }) {
  const poll = msg.poll!;
  return (
    <div className="space-y-1.5">
      <p className="font-medium">📊 {poll.question}</p>
      {poll.options.map((o, i) => {
        const pct = poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0;
        return (
          <div key={i} className="relative overflow-hidden rounded-md border border-hairline">
            <div className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${pct}%` }} />
            <div className="relative flex justify-between px-2.5 py-1.5 text-xs">
              <span>{o.text}</span>
              <span className="font-medium text-muted-foreground">{o.votes} · {pct}%</span>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{poll.totalVotes} vote{poll.totalVotes === 1 ? "" : "s"}</p>
    </div>
  );
}
