"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserPlus, UserMinus, Loader2, Save, Trash2, Pause, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  assignAffiliateToCampaign,
  removeAffiliateFromCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
} from "@/app/actions/admin";
import { formatCurrency } from "@/lib/utils";
import type { Affiliate, Campaign } from "@/lib/types";

export function CampaignManager({
  campaign,
  members,
  candidates,
}: {
  campaign: Campaign;
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

  const run = (fn: () => Promise<{ ok: boolean; message: string }>, id?: string) => {
    if (id) setBusyId(id);
    start(async () => {
      const res = await fn();
      toast(res.message, res.ok ? "success" : "error");
      setBusyId(null);
      router.refresh();
    });
  };

  const saveDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() =>
      updateCampaign(campaign.id, {
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? ""),
        codePrefix: String(fd.get("codePrefix") ?? ""),
        rewardType: String(fd.get("rewardType") ?? "percent"),
        rewardValue: String(fd.get("rewardValue") ?? "0"),
        friendRewardType: String(fd.get("friendRewardType") ?? "percent"),
        friendRewardValue: String(fd.get("friendRewardValue") ?? "0"),
      }),
    );
  };

  const del = () => {
    if (!confirm(`Delete "${campaign.name}"? Affiliates stay, but lose this campaign.`)) return;
    start(async () => {
      const res = await deleteCampaign(campaign.id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.push("/admin/campaigns");
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
                No affiliates in this campaign yet. Add them from the panel on the right.
              </p>
            )}
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                <Avatar name={m.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-mono">{m.code}</span> · {m.email}
                  </p>
                </div>
                <span className="tnum hidden text-sm text-muted-foreground sm:block">{formatCurrency(m.totalEarned)}</span>
                <Button size="sm" variant="outline" onClick={() => run(() => removeAffiliateFromCampaign(m.id, campaign.id), m.id)} disabled={busyId === m.id}>
                  {busyId === m.id ? <Loader2 className="size-4 animate-spin" /> : <UserMinus className="size-4" />} Remove
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
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  {candidates.length === 0 ? "All approved affiliates are in this campaign." : "No matches."}
                </p>
              )}
              {filtered.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-hairline p-2">
                  <Avatar name={a.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.email}</p>
                  </div>
                  <Button size="icon-sm" onClick={() => run(() => assignAffiliateToCampaign(a.id, campaign.id), a.id)} disabled={busyId === a.id} title="Add">
                    {busyId === a.id ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Settings</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run(() => setCampaignStatus(campaign.id, campaign.status === "active" ? "paused" : "active"))}
              disabled={pending}
            >
              {campaign.status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
              {campaign.status === "active" ? "Pause" : "Activate"}
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveDetails} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input name="name" defaultValue={campaign.name} required />
              </div>
              <div className="space-y-1.5">
                <Label>{campaign.type === "referral" ? "Advocate reward (give)" : "Commission"}</Label>
                <div className="flex gap-2">
                  <Input name="rewardValue" type="number" step="0.01" defaultValue={campaign.rewardValue} className="flex-1" />
                  <select name="rewardType" defaultValue={campaign.rewardType} className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                    <option value="percent">%</option>
                    <option value="flat">$</option>
                  </select>
                </div>
              </div>
              {campaign.type === "referral" && (
                <div className="space-y-1.5">
                  <Label>Friend reward (get)</Label>
                  <div className="flex gap-2">
                    <Input name="friendRewardValue" type="number" step="0.01" defaultValue={campaign.friendRewardValue} className="flex-1" />
                    <select name="friendRewardType" defaultValue={campaign.friendRewardType} className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                      <option value="percent">%</option>
                      <option value="flat">$</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Code prefix</Label>
                <Input name="codePrefix" defaultValue={campaign.codePrefix ?? ""} placeholder="SUMMER" />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea name="description" defaultValue={campaign.description} />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
                </Button>
                <Button type="button" variant="outline" className="text-danger hover:bg-danger-soft" onClick={del} disabled={pending}>
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
