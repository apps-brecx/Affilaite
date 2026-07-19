"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Settings2, Loader2, UserPlus, UserMinus, Trash2, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { AvatarPicker } from "@/components/admin/new-group-button";
import { updateGroupChat, deleteGroupChat, addGroupMembers, removeGroupMember } from "@/app/actions/messaging";
import type { GroupSummary, GroupMemberRow } from "@/lib/messaging";

export function GroupManage({
  group,
  members,
  addable,
}: {
  group: GroupSummary;
  members: GroupMemberRow[];
  addable: { id: string; name: string; email: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"members" | "settings">("members");
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [emoji, setEmoji] = useState(group.avatarEmoji);
  const [color, setColor] = useState(group.avatarColor);
  const [visibility, setVisibility] = useState<"public" | "private">(group.visibility);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const act = (fn: () => Promise<{ ok: boolean; message: string }>, close = false) =>
    start(async () => {
      const res = await fn();
      if (res.message) toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        if (close) setOpen(false);
        setPicked(new Set());
        router.refresh();
      }
    });

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><Settings2 className="size-4" /> Manage</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={group.name} description={`${group.memberCount} member${group.memberCount === 1 ? "" : "s"}`} className="max-w-lg">
        <div className="mb-4 flex gap-1 rounded-lg bg-accent p-1 text-sm">
          {(["members", "settings"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md py-1.5 font-medium capitalize ${tab === t ? "bg-card shadow-subtle" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>

        {tab === "members" ? (
          <div className="space-y-4">
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {members.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No members yet.</p>}
              {members.map((m) => (
                <div key={m.affiliateId} className="flex items-center gap-2 rounded-lg px-1 py-1.5">
                  <Avatar name={m.name} size={30} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m.name}</p><p className="truncate text-xs text-muted-foreground">{m.email}</p></div>
                  {!group.isMain && (
                    <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => act(() => removeGroupMember(group.id, m.affiliateId))}><UserMinus className="size-4 text-danger" /></Button>
                  )}
                </div>
              ))}
            </div>
            {addable.length > 0 && (
              <div className="border-t border-hairline pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add members</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {addable.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-accent">
                      <input type="checkbox" checked={picked.has(a.id)} onChange={() => toggle(a.id)} className="size-4" />
                      <Avatar name={a.name} size={26} />
                      <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
                    </label>
                  ))}
                </div>
                <Button size="sm" className="mt-2 w-full" disabled={pending || picked.size === 0} onClick={() => act(() => addGroupMembers(group.id, [...picked]))}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <><UserPlus className="size-4" /> Add {picked.size || ""}</>}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <AvatarPicker emoji={emoji} color={color} setEmoji={setEmoji} setColor={setColor} />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" disabled={group.isMain} />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={2} />
            {!group.isMain && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setVisibility("public")} className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm ${visibility === "public" ? "border-primary bg-primary/5" : "border-hairline"}`}><Globe className="size-4 text-primary" /> Public</button>
                <button type="button" onClick={() => setVisibility("private")} className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm ${visibility === "private" ? "border-primary bg-primary/5" : "border-hairline"}`}><Lock className="size-4 text-primary" /> Private</button>
              </div>
            )}
            <Button className="w-full" disabled={pending} onClick={() => act(() => updateGroupChat(group.id, { name, description, avatarEmoji: emoji, avatarColor: color, visibility }))}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
            {!group.isMain && (
              <Button variant="ghost" className="w-full text-danger hover:text-danger" disabled={pending} onClick={() => { if (confirm(`Delete "${group.name}"? This can't be undone.`)) act(() => deleteGroupChat(group.id), true); }}>
                <Trash2 className="size-4" /> Delete group
              </Button>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
