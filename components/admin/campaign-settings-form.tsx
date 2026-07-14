"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2, Zap, ShieldCheck, Lock, Link2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { updateCampaign, deleteCampaign } from "@/app/actions/admin";
import type { Campaign } from "@/lib/types";

const ACCESS = [
  { id: "instant", label: "Instant access", icon: Zap, hint: "Approved + code right away" },
  { id: "approval", label: "Requires approval", icon: ShieldCheck, hint: "You approve each applicant" },
  { id: "invite", label: "Invite only", icon: Lock, hint: "Add or invite manually" },
] as const;

const dateVal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export function CampaignSettingsForm({ campaign, appUrl }: { campaign: Campaign; appUrl: string }) {
  const [access, setAccess] = useState(campaign.access);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const joinUrl = `${appUrl}/join/${campaign.slug ?? ""}`;

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateCampaign(campaign.id, {
        name: String(fd.get("name") ?? ""),
        access,
        slug: String(fd.get("slug") ?? ""),
        shortCode: String(fd.get("shortCode") ?? ""),
        destinationUrl: String(fd.get("destinationUrl") ?? ""),
        startsAt: String(fd.get("startsAt") ?? ""),
        endsAt: String(fd.get("endsAt") ?? ""),
        description: String(fd.get("description") ?? ""),
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
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
    <div className="space-y-6">
      {campaign.slug && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Link2 className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">Campaign signup link</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{joinUrl}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {campaign.access === "invite" && <Badge variant="warning">Invite only</Badge>}
              <CopyButton value={joinUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Campaign settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="max-w-2xl space-y-5">
            <div className="space-y-1.5">
              <Label>Campaign name</Label>
              <Input name="name" defaultValue={campaign.name} required />
            </div>

            <div className="space-y-1.5">
              <Label>Access</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ACCESS.map((a) => (
                  <button
                    type="button"
                    key={a.id}
                    onClick={() => setAccess(a.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      access === a.id ? "border-primary/40 bg-primary/[0.04]" : "border-hairline hover:bg-accent"
                    }`}
                  >
                    <a.icon className={`mb-1 size-4 ${access === a.id ? "text-primary" : "text-muted-foreground"}`} />
                    <p className="text-sm font-medium">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground">{a.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Campaign URL</Label>
                <Input name="slug" defaultValue={campaign.slug ?? ""} placeholder="summer" />
                <p className="truncate text-[11px] text-muted-foreground">{appUrl}/join/…</p>
              </div>
              <div className="space-y-1.5">
                <Label>Short code</Label>
                <Input name="shortCode" defaultValue={campaign.shortCode ?? ""} placeholder="SUMMER" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Link destination</Label>
              <Input name="destinationUrl" defaultValue={campaign.destinationUrl ?? ""} placeholder="https://syruvia.com" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input name="startsAt" type="date" defaultValue={dateVal(campaign.startsAt)} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry (optional)</Label>
                <Input name="endsAt" type="date" defaultValue={dateVal(campaign.endsAt)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea name="description" defaultValue={campaign.description} />
            </div>

            <div className="flex items-center justify-between border-t border-hairline pt-5">
              <Button type="button" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={del} disabled={pending}>
                <Trash2 className="size-4" /> Delete campaign
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
