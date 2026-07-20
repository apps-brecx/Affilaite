"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, Users, UserCheck, Clock, Layers, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { sendBroadcast } from "@/app/actions/admin";

type Mode = "approved" | "pending" | "everyone" | "group" | "people";

export function EmailComposer({
  groups,
  people,
}: {
  groups: { id: string; name: string }[];
  people: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("approved");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const modes: { key: Mode; label: string; icon: any }[] = [
    { key: "approved", label: "All approved", icon: UserCheck },
    { key: "pending", label: "Applicants", icon: Clock },
    { key: "everyone", label: "Everyone", icon: Users },
    { key: "group", label: "A group", icon: Layers },
    { key: "people", label: "Specific", icon: User },
  ];

  const send = () =>
    start(async () => {
      if (!subject.trim() || !body.trim()) return toast("Add a subject and message.", "error");
      const target =
        mode === "group" ? { groupIds: groupId ? [groupId] : [] } :
        mode === "people" ? { affiliateIds: [...picked] } :
        mode === "everyone" ? { status: ["approved", "pending", "suspended"] } :
        mode === "pending" ? { status: ["pending"] } :
        { status: ["approved"] };
      if (mode === "people" && picked.size === 0) return toast("Pick at least one partner.", "error");
      const res = await sendBroadcast({ subject, body, ...target, ctaText, ctaUrl, imageUrl });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setOpen(false);
        setSubject(""); setBody(""); setCtaText(""); setCtaUrl(""); setImageUrl(""); setPicked(new Set());
        router.refresh();
      }
    });

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label="Send email"><Mail className="size-4" /></Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Send an email" description="Reach partners by segment, group, or individually — with an optional button." className="max-w-lg">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recipients</p>
            <div className="flex flex-wrap gap-1.5">
              {modes.map((m) => (
                <button key={m.key} onClick={() => setMode(m.key)} className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${mode === m.key ? "bg-primary text-primary-foreground" : "bg-accent text-muted-foreground hover:text-foreground"}`}>
                  <m.icon className="size-3.5" /> {m.label}
                </button>
              ))}
            </div>
          </div>

          {mode === "group" && (
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          {mode === "people" && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-hairline p-2">
              {people.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent">
                  <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="size-4" />
                  <Avatar name={p.name} size={24} /><span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>
          )}

          <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <Textarea placeholder="Write your message… Use {{name}} to personalize." value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input placeholder="Button text (optional)" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
            <Input placeholder="Button link (https://…)" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
          </div>
          <Input placeholder="Header image URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <Button className="w-full" disabled={pending} onClick={send}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <><Mail className="size-4" /> Send email</>}
          </Button>
        </div>
      </Modal>
    </>
  );
}
