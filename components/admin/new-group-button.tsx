"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { GroupAvatar, GROUP_COLORS } from "@/components/ui/group-avatar";
import { useToast } from "@/components/ui/toast";
import { createGroupChat } from "@/app/actions/messaging";

export const EMOJIS = ["💬", "📣", "🎯", "🔥", "⭐", "🚀", "💎", "🎁", "🏆", "👑", "💰", "🌟", "🥤", "❤️", "✨"];
export const COLORS = Object.keys(GROUP_COLORS);

export function AvatarPicker({
  emoji,
  color,
  setEmoji,
  setColor,
}: {
  emoji: string;
  color: string;
  setEmoji: (e: string) => void;
  setColor: (c: string) => void;
}) {
  return (
    <div className="flex gap-4">
      <GroupAvatar emoji={emoji} color={color} size={64} />
      <div className="flex-1 space-y-2">
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)} className={`flex size-8 items-center justify-center rounded-lg text-lg ${emoji === e ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-accent"}`}>{e}</button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`size-6 rounded-full bg-gradient-to-br ${GROUP_COLORS[c]} ${color === c ? "ring-2 ring-offset-1 ring-foreground" : ""}`} aria-label={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function NewGroupButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [color, setColor] = useState("emerald");
  const [visibility, setVisibility] = useState<"public" | "private">("private");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const create = () =>
    start(async () => {
      const res = await createGroupChat({ name, description, emoji, avatarEmoji: emoji, avatarColor: color, visibility });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setOpen(false);
        setName("");
        setDescription("");
        router.refresh();
      }
    });

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus className="size-4" /> New group</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New group" description="Create a channel to broadcast to a segment of partners." className="max-w-md">
        <div className="space-y-4">
          <AvatarPicker emoji={emoji} color={color} setEmoji={setEmoji} setColor={setColor} />
          <Input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea placeholder="What's this group for? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setVisibility("public")} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm ${visibility === "public" ? "border-primary bg-primary/5" : "border-hairline"}`}>
              <Globe className="size-4 text-primary" /><div><p className="font-medium">Public</p><p className="text-xs text-muted-foreground">Partners can find &amp; join</p></div>
            </button>
            <button type="button" onClick={() => setVisibility("private")} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm ${visibility === "private" ? "border-primary bg-primary/5" : "border-hairline"}`}>
              <Lock className="size-4 text-primary" /><div><p className="font-medium">Private</p><p className="text-xs text-muted-foreground">Invite-only, hidden</p></div>
            </button>
          </div>
          <Button onClick={create} disabled={pending || name.trim().length < 2} className="w-full">
            {pending ? <Loader2 className="size-4 animate-spin" /> : "Create group"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
