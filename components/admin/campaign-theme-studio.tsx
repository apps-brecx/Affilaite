"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Loader2, Save, Upload, X, ExternalLink, Gift, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveCampaignTheme } from "@/app/actions/admin";
import type { CampaignBrand } from "@/lib/campaign-config";

const MAX_IMG = 2.4 * 1024 * 1024; // ~2.4MB after base64
const PRESETS = ["#FF5C9E", "#7C5CFF", "#22C55E", "#F97316", "#0EA5E9", "#E11D48", "#14B8A6", "#EAB308"];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-hairline bg-transparent p-0.5"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="size-6 rounded-full border border-hairline ring-offset-2 ring-offset-background transition hover:scale-110"
            style={{ background: c }}
            aria-label={`Use ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const pick = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose an image file.", "error");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (url.length > MAX_IMG) return toast("Image is too large — pick one under ~1.8MB.", "error");
      onChange(url);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {value ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-20 rounded-lg border border-hairline object-cover" />
          <button type="button" onClick={() => onChange("")} className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-danger text-danger-foreground">
            <X className="size-3" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline py-5 text-sm text-muted-foreground hover:bg-accent/40">
          <Upload className="size-4" /> Upload
        </button>
      )}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export function CampaignThemeStudio({
  campaignId,
  campaignName,
  brand,
  rewardLine,
}: {
  campaignId: string;
  campaignName: string;
  brand: CampaignBrand;
  rewardLine: string;
}) {
  const [b, setB] = useState<CampaignBrand>(brand);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = (patch: Partial<CampaignBrand>) => setB((prev) => ({ ...prev, ...patch }));

  const save = () =>
    start(async () => {
      const res = await saveCampaignTheme(campaignId, b);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  const headline = b.headline || campaignName;
  const subtext = b.subtext || "Share what you love and earn on every sale.";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Controls */}
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-xl border border-hairline bg-card p-4">
          <div>
            <p className="font-medium">Use a custom theme</p>
            <p className="text-sm text-muted-foreground">When off, this campaign uses the global brand.</p>
          </div>
          <Switch checked={b.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        </div>

        <div className={b.enabled ? "space-y-5" : "pointer-events-none space-y-5 opacity-50"}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Brand name (wordmark)</Label>
              <Input value={b.logoText} onChange={(e) => set({ logoText: e.target.value })} placeholder={campaignName} />
            </div>
            <ImageField label="Logo image" value={b.logoImage} onChange={(v) => set({ logoImage: v })} hint="Optional — replaces the wordmark." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Primary color" value={b.primaryColor} onChange={(v) => set({ primaryColor: v })} />
            <ColorField label="Accent color" value={b.accentColor} onChange={(v) => set({ accentColor: v })} />
          </div>

          <ImageField label="Hero image" value={b.heroImage} onChange={(v) => set({ heroImage: v })} hint="Optional banner across the top of the join page." />

          <div className="space-y-1.5">
            <Label>Headline</Label>
            <Input value={b.headline} onChange={(e) => set({ headline: e.target.value })} placeholder={`Defaults to “${campaignName}”`} />
          </div>
          <div className="space-y-1.5">
            <Label>Subtext</Label>
            <Textarea value={b.subtext} onChange={(e) => set({ subtext: e.target.value })} rows={2} placeholder="A short welcome line under the headline" />
          </div>
          <div className="space-y-1.5">
            <Label>Approved message</Label>
            <Textarea value={b.approvedMessage} onChange={(e) => set({ approvedMessage: e.target.value })} rows={2} placeholder="Shown after someone joins instantly" />
          </div>
        </div>

        <Button onClick={save} disabled={pending} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save theme
        </Button>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Label className="mb-2 block">Live preview · what partners see</Label>
        <div className="overflow-hidden rounded-2xl border border-hairline bg-background shadow-subtle">
          {b.heroImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.heroImage} alt="" className="h-24 w-full object-cover" />
          )}
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <span className="flex items-center gap-2 font-display text-base font-semibold">
              {b.logoImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logoImage} alt="" className="h-6 w-auto object-contain" />
              ) : (
                <>
                  <span className="flex size-6 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: b.primaryColor }}>
                    {(b.logoText || campaignName || "S").charAt(0)}
                  </span>
                  {b.logoText || campaignName}
                </>
              )}
            </span>
            <span className="text-xs font-medium" style={{ color: b.accentColor }}>Partner program</span>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: b.primaryColor }}>
                <Gift className="size-3" /> Referral program
              </span>
              <h3 className="font-display text-2xl font-semibold leading-tight">{headline}</h3>
              <p className="text-sm text-muted-foreground">{subtext}</p>
              <div className="space-y-1.5 pt-1">
                <p className="flex items-center gap-2 text-sm"><Sparkles className="size-4" style={{ color: b.primaryColor }} /> {rewardLine}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" style={{ color: b.accentColor }} /> Instant approval</p>
              </div>
            </div>
            <div className="rounded-xl border border-hairline p-4">
              <p className="mb-2 text-sm font-medium">Join in seconds</p>
              <div className="space-y-2">
                <div className="h-8 rounded-md bg-muted" />
                <div className="h-8 rounded-md bg-muted" />
                <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium text-white" style={{ background: b.primaryColor }}>
                  Join now <ExternalLink className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Palette className="size-3.5" /> {b.enabled ? "This theme is live on the join page." : "Enable the theme above to apply it."}
        </p>
      </div>
    </div>
  );
}
