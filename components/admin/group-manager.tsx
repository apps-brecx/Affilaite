"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, UserMinus, Loader2, Save, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { updateGroup, deleteGroup, setAffiliateGroup } from "@/app/actions/admin";
import { formatCurrency } from "@/lib/utils";
import type { Affiliate, Group } from "@/lib/types";

export function GroupManager({
  group,
  members,
  candidates,
}: {
  group: Group;
  members: Affiliate[];
  candidates: Affiliate[];
}) {
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const router = useRouter();
  const toast = useToast();

  const filtered = useMemo(
    () => candidates.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase())),
    [candidates, q],
  );

  const move = (affiliateId: string, groupId: string | null) => {
    setBusyId(affiliateId);
    start(async () => {
      const res = await setAffiliateGroup(affiliateId, groupId);
      toast(res.message, res.ok ? "success" : "error");
      setBusyId(null);
      router.refresh();
    });
  };

  const saveDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateGroup(group.id, {
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? ""),
      });
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });
  };

  const remove = () => {
    if (!confirm(`Delete the group "${group.name}"? Members will be un-grouped (not deleted).`)) return;
    start(async () => {
      const res = await deleteGroup(group.id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.push("/admin/groups");
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Members */}
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Members</CardTitle>
            <Badge variant="secondary">{members.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No members yet. Add affiliates from the panel on the right.
              </p>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                </div>
                <span className="tnum hidden text-sm text-muted-foreground sm:block">{formatCurrency(m.totalEarned)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => move(m.id, null)}
                  disabled={busyId === m.id}
                >
                  {busyId === m.id ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-4" />}
                  Remove
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Right: add + settings */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add affiliates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search affiliates…" className="pl-9" />
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {candidates.length === 0 ? "All approved affiliates are already in this group." : "No matches."}
                </p>
              )}
              {filtered.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-hairline p-2">
                  <Avatar name={a.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.groupName ? `in ${a.groupName}` : a.email}
                    </p>
                  </div>
                  <Button size="icon-sm" onClick={() => move(a.id, group.id)} disabled={busyId === a.id} title="Add to group">
                    {busyId === a.id ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Group settings</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveDetails} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input name="name" defaultValue={group.name} required />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea name="description" defaultValue={group.description} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                </Button>
                <Button type="button" variant="outline" className="text-danger hover:bg-danger-soft" onClick={remove} disabled={pending}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
