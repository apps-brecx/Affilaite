"use client";

import { useEffect, useState, useTransition } from "react";
import { Megaphone, Check } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { markGroupRead, votePoll } from "@/app/actions/affiliate";
import { relativeTime } from "@/lib/utils";
import type { GroupChatMessage } from "@/lib/types";

export function AffiliateGroupChat({ groupName, initial }: { groupName: string; initial: GroupChatMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [, start] = useTransition();
  const toast = useToast();

  // Opening the feed marks everything read (feeds the admin's read receipts).
  useEffect(() => {
    markGroupRead().catch(() => {});
  }, []);

  const vote = (messageId: string, optionIndex: number) => {
    // optimistic
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId || !m.poll) return m;
        const wasVoted = m.myVote;
        const options = m.poll.options.map((o, i) => {
          let votes = o.votes;
          if (i === optionIndex) votes += 1;
          if (wasVoted === i) votes -= 1;
          return { ...o, votes };
        });
        const totalVotes = m.poll.totalVotes + (wasVoted === null ? 1 : 0);
        return { ...m, myVote: optionIndex, poll: { ...m.poll, options, totalVotes } };
      }),
    );
    start(async () => {
      const res = await votePoll(messageId, optionIndex);
      if (!res.ok) toast(res.message, "error");
    });
  };

  if (messages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline py-16 text-center">
        <Megaphone className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-medium">No messages in {groupName} yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Updates, drops, and polls from the team will show up here.</p>
      </div>
    );
  }

  // Oldest → newest, WhatsApp style (server sends newest first).
  const ordered = [...messages].reverse();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      {ordered.map((m) => (
        <div key={m.id} className="max-w-[85%] self-start rounded-2xl rounded-tl-sm border border-hairline bg-card p-3 shadow-subtle">
          {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
          {m.attachments.map((a, i) => (
            <div key={i} className="mt-2">
              {a.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" className="max-h-72 rounded-lg" />
              ) : a.type === "video" ? (
                <video src={a.url} controls className="max-h-72 w-full rounded-lg" />
              ) : (
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Open attachment</a>
              )}
            </div>
          ))}
          {m.poll && (
            <div className="mt-2 space-y-1.5">
              <p className="text-sm font-medium">{m.poll.question}</p>
              {m.poll.options.map((o, i) => {
                const pct = m.poll!.totalVotes ? Math.round((o.votes / m.poll!.totalVotes) * 100) : 0;
                const mine = m.myVote === i;
                return (
                  <button
                    key={i}
                    onClick={() => vote(m.id, i)}
                    className={`relative w-full overflow-hidden rounded-lg border px-3 py-1.5 text-left text-sm transition-colors ${mine ? "border-primary bg-primary/5" : "border-hairline hover:bg-accent/50"}`}
                  >
                    <span className="absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${pct}%` }} />
                    <span className="relative flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5">{mine && <Check className="size-3.5 text-primary" />}{o.text}</span>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </span>
                  </button>
                );
              })}
              <p className="text-[11px] text-muted-foreground">{m.poll.totalVotes} vote{m.poll.totalVotes === 1 ? "" : "s"} · tap to vote</p>
            </div>
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">{relativeTime(m.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}
