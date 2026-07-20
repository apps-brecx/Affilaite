"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, Trash2, Mail, Pencil, Check, ShieldCheck, X } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { inviteTeamMember, updateTeamPermissions, removeTeamMember, resendTeamInvite } from "@/app/actions/team";
import type { TeamMember } from "@/lib/team";

type Area = { key: string; label: string };

function AreaPicker({ areas, value, onChange }: { areas: Area[]; value: Set<string>; onChange: (s: Set<string>) => void }) {
  const toggle = (k: string) => {
    const n = new Set(value);
    n.has(k) ? n.delete(k) : n.add(k);
    onChange(n);
  };
  const allOn = areas.every((a) => value.has(a.key));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Areas they can access</Label>
        <button type="button" onClick={() => onChange(allOn ? new Set() : new Set(areas.map((a) => a.key)))} className="text-xs font-medium text-primary hover:underline">
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {areas.map((a) => {
          const on = value.has(a.key);
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => toggle(a.key)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${on ? "border-primary bg-primary/5 text-foreground" : "border-hairline text-muted-foreground hover:border-primary/30"}`}
            >
              <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-primary bg-primary text-primary-foreground" : "border-hairline"}`}>
                {on && <Check className="size-3" />}
              </span>
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TeamManager({ members, areas, currentUserId }: { members: TeamMember[]; areas: Area[]; currentUserId: string }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [invitePerms, setInvitePerms] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const labelFor = (k: string) => areas.find((a) => a.key === k)?.label ?? k;

  const invite = () =>
    start(async () => {
      const res = await inviteTeamMember({ email, name, permissions: [...invitePerms] });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setInviteOpen(false);
        setEmail(""); setName(""); setInvitePerms(new Set());
        router.refresh();
      }
    });

  const startEdit = (m: TeamMember) => {
    setEditing(m.id);
    setEditPerms(new Set(m.permissions));
  };

  const saveEdit = (id: string) =>
    start(async () => {
      const res = await updateTeamPermissions(id, [...editPerms]);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setEditing(null);
        router.refresh();
      }
    });

  const remove = (m: TeamMember) =>
    start(async () => {
      if (!confirm(`Remove ${m.name}'s admin access?`)) return;
      const res = await removeTeamMember(m.id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  const resend = (m: TeamMember) =>
    start(async () => {
      const res = await resendTeamInvite(m.id);
      toast(res.message, res.ok ? "success" : "error");
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" /> Invite team member
        </Button>
      </div>

      <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-card">
        {members.map((m) => {
          const isMe = m.id === currentUserId;
          const isEditing = editing === m.id;
          return (
            <div key={m.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar name={m.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {m.name} {isMe && <span className="text-xs text-muted-foreground">(you)</span>}
                    {m.isOwner ? (
                      <Badge variant="gold" className="gap-1"><ShieldCheck className="size-3" /> Owner</Badge>
                    ) : (
                      <Badge variant="secondary">Team member</Badge>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{m.email}</p>

                  {!m.isOwner && !isEditing && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.permissions.length === 0 && <span className="text-xs text-muted-foreground">No areas assigned</span>}
                      {m.permissions.map((p) => (
                        <span key={p} className="rounded-full border border-hairline bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{labelFor(p)}</span>
                      ))}
                    </div>
                  )}
                  {m.isOwner && <p className="mt-1 text-xs text-muted-foreground">Full access to everything, including the team.</p>}

                  {isEditing && (
                    <div className="mt-3 rounded-lg border border-hairline p-3">
                      <AreaPicker areas={areas} value={editPerms} onChange={setEditPerms} />
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(m.id)} disabled={pending}>
                          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save access
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="size-4" /> Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>

                {!m.isOwner && !isEditing && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon-sm" variant="ghost" aria-label="Edit access" onClick={() => startEdit(m)}><Pencil className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Resend invite" onClick={() => resend(m)} disabled={pending}><Mail className="size-4" /></Button>
                    <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => remove(m)} disabled={pending}><Trash2 className="size-4" /></Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite a team member" description="They'll get admin access to only the areas you choose." className="max-w-lg">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@brecx.com" />
            </div>
          </div>
          <AreaPicker areas={areas} value={invitePerms} onChange={setInvitePerms} />
          <Button className="w-full" onClick={invite} disabled={pending || !email.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} Send invite
          </Button>
        </div>
      </Modal>
    </div>
  );
}
