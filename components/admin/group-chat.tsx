"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Paperclip, BarChart3, X, Loader2, Check, Eye, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sendGroupMessage } from "@/app/actions/admin";
import { relativeTime } from "@/lib/utils";
import type { GroupChatMessage } from "@/lib/types";

function guessType(url: string): string {
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(u)) return "image";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/.test(u)) return "video";
  return "file";
}

export function GroupChat({ groupId, memberCount, messages }: { groupId: string; memberCount: number; messages: GroupChatMessage[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  const [body, setBody] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachments, setAttachments] = useState<{ type: string; url: string; name?: string }[]>([]);
  const [pollOn, setPollOn] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const addAttachment = () => {
    const url = attachUrl.trim();
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast("Enter a valid URL.", "error");
      return;
    }
    setAttachments((a) => [...a, { type: guessType(url), url }]);
    setAttachUrl("");
  };

  const send = () => {
    const poll = pollOn
      ? { question: question.trim(), options: options.map((o) => o.trim()).filter(Boolean) }
      : null;
    if (pollOn && (!poll!.question || poll!.options.length < 2)) {
      toast("A poll needs a question and at least two options.", "error");
      return;
    }
    start(async () => {
      const res = await sendGroupMessage(groupId, { body, attachments, poll });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setBody(""); setAttachments([]); setPollOn(false); setQuestion(""); setOptions(["", ""]);
        router.refresh();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="size-4 text-primary" /> Group chat</CardTitle>
        <p className="text-xs text-muted-foreground">Posts appear in every member&apos;s Community feed. Members can&apos;t see each other or reply.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Composer */}
        <div className="space-y-2 rounded-xl border border-hairline p-3">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Write a message to the group…" />
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
                  {a.type} · {a.url.split("/").pop()?.slice(0, 18)}
                  <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))}><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Paperclip className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={attachUrl} onChange={(e) => setAttachUrl(e.target.value)} placeholder="Paste image / video / file URL" className="h-9 pl-8 text-sm" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAttachment())} />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addAttachment}>Attach</Button>
            <Button type="button" variant={pollOn ? "default" : "outline"} size="sm" onClick={() => setPollOn((v) => !v)}>
              <BarChart3 className="size-4" /> Poll
            </Button>
          </div>

          {pollOn && (
            <div className="space-y-2 rounded-lg bg-muted/40 p-2.5">
              <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Poll question" className="h-9 text-sm" />
              {options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={o} onChange={(e) => setOptions((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))} placeholder={`Option ${i + 1}`} className="h-8 text-sm" />
                  {options.length > 2 && <button onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))}><X className="size-4 text-muted-foreground" /></button>}
                </div>
              ))}
              {options.length < 8 && (
                <button onClick={() => setOptions((a) => [...a, ""])} className="inline-flex items-center gap-1 text-xs text-primary"><Plus className="size-3" /> Add option</button>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to {memberCount} member{memberCount === 1 ? "" : "s"}
            </Button>
          </div>
        </div>

        {/* Feed with read receipts */}
        <div className="space-y-3">
          {messages.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className="rounded-xl border border-hairline p-3">
              {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
              {m.attachments.map((a, i) => (
                <div key={i} className="mt-2">
                  {a.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt="" className="max-h-56 rounded-lg" />
                  ) : a.type === "video" ? (
                    <video src={a.url} controls className="max-h-56 rounded-lg" />
                  ) : (
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{a.url}</a>
                  )}
                </div>
              ))}
              {m.poll && (
                <div className="mt-2 space-y-1.5 rounded-lg bg-muted/40 p-2.5">
                  <p className="text-sm font-medium">{m.poll.question}</p>
                  {m.poll.options.map((o, i) => {
                    const pct = m.poll!.totalVotes ? Math.round((o.votes / m.poll!.totalVotes) * 100) : 0;
                    return (
                      <div key={i} className="text-xs">
                        <div className="flex justify-between"><span>{o.text}</span><span className="text-muted-foreground">{o.votes} · {pct}%</span></div>
                        <div className="mt-0.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground">{m.poll.totalVotes} vote{m.poll.totalVotes === 1 ? "" : "s"}</p>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{relativeTime(m.createdAt)}</span>
                <span className="inline-flex items-center gap-1" title={m.readers.join(", ")}>
                  {m.readCount >= memberCount && memberCount > 0 ? <Check className="size-3 text-primary" /> : <Eye className="size-3" />}
                  Seen by {m.readCount}{memberCount > 0 ? `/${memberCount}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
