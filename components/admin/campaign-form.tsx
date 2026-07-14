"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2, Users, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { createCampaign } from "@/app/actions/admin";

export function CampaignForm() {
  const [type, setType] = useState<"affiliate" | "referral">("affiliate");
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
        description: String(fd.get("description") ?? ""),
        codePrefix: String(fd.get("codePrefix") ?? ""),
        rewardType: String(fd.get("rewardType") ?? "percent"),
        rewardValue: String(fd.get("rewardValue") ?? "0"),
        friendRewardType: String(fd.get("friendRewardType") ?? "percent"),
        friendRewardValue: String(fd.get("friendRewardValue") ?? "0"),
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        form.reset();
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
        <form onSubmit={submit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "affiliate", label: "Affiliate", icon: Users, hint: "Influencers earn commission" },
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

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder={type === "referral" ? "Give $10, Get $10" : "Summer Creators"} />
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
            <Label>Code prefix <span className="text-muted-foreground">(optional)</span></Label>
            <Input name="codePrefix" placeholder="SUMMER" />
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
