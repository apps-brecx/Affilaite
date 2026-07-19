"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Ticket, Rocket, Gift, Trophy, BarChart3, MessageSquare, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sendGroupChat, sendDirectMessage } from "@/app/actions/messaging";

type Kind = "text" | "deal" | "invite" | "giveaway" | "competition" | "poll";

const GROUP_KINDS: { key: Kind; label: string; icon: any }[] = [
  { key: "text", label: "Message", icon: MessageSquare },
  { key: "deal", label: "Deal", icon: Ticket },
  { key: "invite", label: "Invite", icon: Rocket },
  { key: "giveaway", label: "Giveaway", icon: Gift },
  { key: "competition", label: "Competition", icon: Trophy },
  { key: "poll", label: "Poll", icon: BarChart3 },
];
const DM_KINDS: Kind[] = ["text", "deal", "invite"];

export function MessageComposer({
  target,
  campaigns,
}: {
  target: { type: "group" | "dm"; id: string };
  campaigns: { id: string; name: string }[];
}) {
  const [kind, setKind] = useState<Kind>("text");
  const [body, setBody] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const kinds = target.type === "group" ? GROUP_KINDS : GROUP_KINDS.filter((k) => DM_KINDS.includes(k.key));
  const set = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));

  const reset = () => {
    setBody("");
    setFields({});
    setOptions(["", ""]);
    setKind("text");
  };

  const submit = () =>
    start(async () => {
      let payload: Record<string, any> | undefined;
      let poll: { question: string; options: string[] } | null = null;
      if (kind === "deal") payload = { title: fields.title, code: fields.code, endsAt: fields.endsAt || undefined };
      if (kind === "invite") {
        const camp = campaigns.find((c) => c.id === fields.campaignId);
        if (!camp) return toast("Pick a campaign to invite to.", "error");
        payload = { campaignId: camp.id, campaignName: camp.name };
      }
      if (kind === "giveaway") payload = { prize: fields.prize };
      if (kind === "competition")
        payload = { title: fields.title, prize: fields.prize, metric: fields.metric || "sales", startsAt: new Date().toISOString(), endsAt: fields.endsAt || undefined };
      if (kind === "poll") {
        const opts = options.map((o) => o.trim()).filter(Boolean);
        if (!fields.question?.trim() || opts.length < 2) return toast("Add a question and at least 2 options.", "error");
        poll = { question: fields.question.trim(), options: opts };
      }

      const input = { kind, body, poll, payload };
      const res =
        target.type === "group"
          ? await sendGroupChat(target.id, input)
          : await sendDirectMessage(target.id, { kind, body, payload });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        reset();
        router.refresh();
      }
    });

  return (
    <div className="border-t border-hairline bg-card p-3">
      {/* Kind picker */}
      <div className="mb-2 flex flex-wrap gap-1">
        {kinds.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              kind === k.key ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"
            }`}
          >
            <k.icon className="size-3.5" /> {k.label}
          </button>
        ))}
      </div>

      {/* Kind-specific fields */}
      <div className="space-y-2">
        {kind === "deal" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Deal title (e.g. Weekend 20% off)" value={fields.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            <Input placeholder="Code (optional)" value={fields.code ?? ""} onChange={(e) => set("code", e.target.value)} />
            <Input type="date" value={fields.endsAt ?? ""} onChange={(e) => set("endsAt", e.target.value)} />
          </div>
        )}
        {kind === "invite" && (
          <select
            value={fields.campaignId ?? ""}
            onChange={(e) => set("campaignId", e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a campaign…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {kind === "giveaway" && <Input placeholder="Prize (e.g. $100 gift card)" value={fields.prize ?? ""} onChange={(e) => set("prize", e.target.value)} />}
        {kind === "competition" && (
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Title (e.g. July Sales Sprint)" value={fields.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            <Input placeholder="Prize" value={fields.prize ?? ""} onChange={(e) => set("prize", e.target.value)} />
            <select value={fields.metric ?? "sales"} onChange={(e) => set("metric", e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="sales">Rank by # of sales</option>
              <option value="revenue">Rank by commission earned</option>
            </select>
            <Input type="date" value={fields.endsAt ?? ""} onChange={(e) => set("endsAt", e.target.value)} />
          </div>
        )}
        {kind === "poll" && (
          <div className="space-y-2">
            <Input placeholder="Poll question" value={fields.question ?? ""} onChange={(e) => set("question", e.target.value)} />
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))} />
                {options.length > 2 && (
                  <Button variant="ghost" size="icon-sm" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}><X className="size-4" /></Button>
                )}
              </div>
            ))}
            {options.length < 8 && (
              <Button variant="ghost" size="sm" onClick={() => setOptions((os) => [...os, ""])}><Plus className="size-3.5" /> Add option</Button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Textarea
            placeholder={kind === "text" ? "Type a message…" : "Add a note (optional)…"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-[44px] flex-1 resize-none"
            rows={1}
          />
          <Button onClick={submit} disabled={pending} size="icon" aria-label="Send">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
