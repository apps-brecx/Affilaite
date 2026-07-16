"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2, Users, Gift, Zap, ShieldCheck, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createCampaign } from "@/app/actions/admin";

const ACCESS = [
  { id: "instant", label: "Instant access", icon: Zap, hint: "Sign up → approved + code right away" },
  { id: "approval", label: "Requires approval", icon: ShieldCheck, hint: "You approve each applicant" },
  { id: "invite", label: "Invite only", icon: Lock, hint: "You add or invite people manually" },
] as const;

export function CampaignForm({ appUrl, defaultDestination }: { appUrl: string; defaultDestination: string }) {
  const [type, setType] = useState<"affiliate" | "referral">("affiliate");
  const [access, setAccess] = useState<"instant" | "approval" | "invite">("approval");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createCampaign({
        name: String(fd.get("name") ?? ""),
        type,
        access,
        slug: String(fd.get("slug") ?? ""),
        shortCode: String(fd.get("shortCode") ?? ""),
        destinationUrl: String(fd.get("destinationUrl") ?? ""),
        startsAt: String(fd.get("startsAt") ?? ""),
        endsAt: String(fd.get("endsAt") ?? ""),
        description: String(fd.get("description") ?? ""),
        rewardType: String(fd.get("rewardType") ?? "percent"),
        rewardValue: String(fd.get("rewardValue") ?? "0"),
        friendRewardType: String(fd.get("friendRewardType") ?? "percent"),
        friendRewardValue: String(fd.get("friendRewardValue") ?? "0"),
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok && res.id) {
        // Land on the new campaign's overview so you can finish setting it up.
        router.push(`/admin/campaigns/${res.id}`);
      } else if (res.ok) {
        form.reset();
        setAccess("approval");
        router.refresh();
      }
    });
  };

  return (
    <Card className="h-fit border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Rocket className="size-4" /> New campaign
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-5">
          {/* Type */}
          <div>
            <Label className="mb-1.5 block">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "affiliate", label: "Affiliate", icon: Users, hint: "Creators earn commission" },
                { id: "referral", label: "Referral", icon: Gift, hint: "Customers refer friends" },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setType(t.id as "affiliate" | "referral")}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    type === t.id ? "border-primary/40 bg-primary/[0.04]" : "border-hairline hover:bg-accent"
                  }`}
                >
                  <t.icon className={`mb-1 size-4 ${type === t.id ? "text-primary" : "text-muted-foreground"}`} />
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Access */}
          <div>
            <Label className="mb-1.5 block">Access</Label>
            <div className="space-y-2">
              {ACCESS.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAccess(a.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors ${
                    access === a.id ? "border-primary/40 bg-primary/[0.04]" : "border-hairline hover:bg-accent"
                  }`}
                >
                  <span className={`flex size-8 items-center justify-center rounded-md ${access === a.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <a.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Campaign name</Label>
            <Input name="name" required placeholder={type === "referral" ? "Give $10, Get $10" : "Summer Creators"} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Campaign URL</Label>
              <Input name="slug" placeholder="summer-creators" />
              <p className="truncate text-[11px] text-muted-foreground">{appUrl}/join/…</p>
            </div>
            <div className="space-y-1.5">
              <Label>Short code</Label>
              <Input name="shortCode" placeholder="SUMMER" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{type === "referral" ? "Advocate reward (give)" : "Commission"}</Label>
            <div className="flex gap-2">
              <Input name="rewardValue" type="number" step="0.01" required placeholder="10" className="flex-1" />
              <select name="rewardType" className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option value="percent">%</option>
                <option value="flat">$</option>
              </select>
            </div>
          </div>

          {type === "referral" && (
            <div className="space-y-1.5">
              <Label>Friend reward (get)</Label>
              <div className="flex gap-2">
                <Input name="friendRewardValue" type="number" step="0.01" placeholder="10" className="flex-1" />
                <select name="friendRewardType" className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                  <option value="percent">%</option>
                  <option value="flat">$</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Link destination</Label>
            <Input name="destinationUrl" defaultValue={defaultDestination} />
            <p className="text-[11px] text-muted-foreground">Where referral links land. Default set in Settings.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input name="startsAt" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry <span className="text-muted-foreground">(optional)</span></Label>
              <Input name="endsAt" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea name="description" placeholder="What's this campaign for?" />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Create campaign
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
