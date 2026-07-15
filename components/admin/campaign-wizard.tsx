"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Users, Gift, Zap, ShieldCheck, Lock, ArrowLeft, ArrowRight, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { createCampaign } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

type Type = "affiliate" | "referral";
type Access = "instant" | "approval" | "invite";

const ACCESS = [
  { id: "instant", label: "Instant access", icon: Zap, hint: "Sign up → approved + code right away" },
  { id: "approval", label: "Requires approval", icon: ShieldCheck, hint: "You approve each applicant" },
  { id: "invite", label: "Invite only", icon: Lock, hint: "You add or invite people manually" },
] as const;

const STEPS = ["Type", "Settings", "Review"];

export function CampaignWizard({ appUrl, defaultDestination }: { appUrl: string; defaultDestination: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const [type, setType] = useState<Type>("affiliate");
  const [access, setAccess] = useState<Access>("approval");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [rewardValue, setRewardValue] = useState("10");
  const [rewardType, setRewardType] = useState<"percent" | "flat">("percent");
  const [friendValue, setFriendValue] = useState("10");
  const [friendType, setFriendType] = useState<"percent" | "flat">("percent");
  const [destination, setDestination] = useState(defaultDestination);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setStep(0);
    setType("affiliate");
    setAccess("approval");
    setName("");
    setSlug("");
    setShortCode("");
    setRewardValue("10");
    setRewardType("percent");
    setFriendValue("10");
    setFriendType("percent");
    setDestination(defaultDestination);
    setStartsAt("");
    setEndsAt("");
    setDescription("");
  };

  const close = () => {
    setOpen(false);
    setTimeout(reset, 200);
  };

  const canNext = step === 0 ? true : step === 1 ? name.trim().length >= 2 : true;

  const submit = () => {
    start(async () => {
      const res = await createCampaign({
        name,
        type,
        access,
        slug,
        shortCode,
        destinationUrl: destination,
        startsAt,
        endsAt,
        description,
        rewardType,
        rewardValue,
        friendRewardType: friendType,
        friendRewardValue: friendValue,
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok && res.id) {
        close();
        router.push(`/admin/campaigns/${res.id}`);
      }
    });
  };

  const money = (v: string, t: string) => (t === "percent" ? `${v}%` : `$${v}`);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Rocket className="size-4" /> New campaign
      </Button>

      <Modal open={open} onClose={close} title="New campaign" description={`Step ${step + 1} of ${STEPS.length} — ${STEPS[step]}`} className="max-w-xl">
        {/* Progress */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/15 text-primary ring-2 ring-primary/30" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-0.5 flex-1 rounded", i < step ? "bg-primary" : "bg-muted")} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Type */}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">What kind of campaign is this?</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "affiliate", label: "Affiliate", icon: Users, hint: "Creators earn commission on sales they drive." },
                { id: "referral", label: "Referral", icon: Gift, hint: "Customers refer friends for a give-get reward." },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id as Type)}
                  className={cn("rounded-xl border p-4 text-left transition-colors", type === t.id ? "border-primary/50 bg-primary/[0.04]" : "border-hairline hover:bg-accent")}
                >
                  <t.icon className={cn("mb-2 size-5", type === t.id ? "text-primary" : "text-muted-foreground")} />
                  <p className="font-medium">{t.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.hint}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2 — Settings */}
        {step === 1 && (
          <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Access</Label>
              <div className="space-y-2">
                {ACCESS.map((a) => (
                  <button key={a.id} onClick={() => setAccess(a.id)} className={cn("flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors", access === a.id ? "border-primary/50 bg-primary/[0.04]" : "border-hairline hover:bg-accent")}>
                    <span className={cn("flex size-8 items-center justify-center rounded-md", access === a.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
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
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "referral" ? "Give $10, Get $10" : "Summer Creators"} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Campaign URL</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="summer-creators" />
                <p className="truncate text-[11px] text-muted-foreground">{appUrl}/join/…</p>
              </div>
              <div className="space-y-1.5">
                <Label>Short code</Label>
                <Input value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="SUMMER" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{type === "referral" ? "Advocate reward (give)" : "Commission"}</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.01" value={rewardValue} onChange={(e) => setRewardValue(e.target.value)} className="flex-1" />
                <select value={rewardType} onChange={(e) => setRewardType(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                  <option value="percent">%</option>
                  <option value="flat">$</option>
                </select>
              </div>
            </div>

            {type === "referral" && (
              <div className="space-y-1.5">
                <Label>Friend reward (get)</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" value={friendValue} onChange={(e) => setFriendValue(e.target.value)} className="flex-1" />
                  <select value={friendType} onChange={(e) => setFriendType(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                    <option value="percent">%</option>
                    <option value="flat">$</option>
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Link destination</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Expiry (optional)</Label>
                <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description (optional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {/* Step 3 — Review */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Review and create.</p>
            <div className="divide-y divide-hairline rounded-lg border border-hairline text-sm">
              {[
                ["Type", type === "referral" ? "Referral" : "Affiliate"],
                ["Name", name || "—"],
                ["Access", access === "instant" ? "Instant access" : access === "invite" ? "Invite only" : "Requires approval"],
                ["Reward", type === "referral" ? `Give ${money(rewardValue, rewardType)}, get ${money(friendValue, friendType)}` : `${money(rewardValue, rewardType)} commission`],
                ["Campaign URL", slug ? `${appUrl}/join/${slug}` : "auto from name"],
                ["Short code", shortCode || "—"],
                ["Starts", startsAt || "today"],
                ["Expiry", endsAt || "none"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="max-w-[60%] truncate text-right font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>Cancel</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Create campaign
            </Button>
          )}
        </div>
      </Modal>
    </>
  );
}
