"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Loader2, Upload, X, Gift, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveCampaignTheme } from "@/app/actions/admin";
import type { CampaignBrand } from "@/lib/campaign-config";

const MAX_IMG = 2_500_000; // ~2.5MB data URL cap (matches the server limit)

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-0.5"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#RRGGBB or blank" className="font-mono text-sm" />
        {value && (
          <Button type="button" variant="ghost" size="icon-sm" title="Clear" onClick={() => onChange("")}>
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function CampaignThemeEditor({
  campaignId,
  initial,
  campaignName,
  campaignDescription,
}: {
  campaignId: string;
  initial: CampaignBrand;
  campaignName: string;
  campaignDescription?: string;
}) {
  const [b, setB] = useState<CampaignBrand>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const set = (patch: Partial<CampaignBrand>) => setB((s) => ({ ...s, ...patch }));

  const onImage = (key: "logoImage" | "heroImage") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMG) {
      toast("That image is too large — keep it under ~2.5MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set({ [key]: String(reader.result ?? "") } as Partial<CampaignBrand>);
    reader.readAsDataURL(file);
  };

  const save = () =>
    start(async () => {
      const res = await saveCampaignTheme(campaignId, b);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  const primary = /^#[0-9a-f]{6}$/i.test(b.primaryColor) ? b.primaryColor : "#FF5C9E";
  const bg = b.enabled && b.backgroundColor ? b.backgroundColor : "";
  const headline = b.headline || campaignName;
  const subtext = b.subtext || campaignDescription || "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4 text-primary" /> Join page appearance
        </CardTitle>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={b.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="size-4 rounded border-hairline accent-[hsl(var(--primary))]" />
          Use custom theme
        </label>
      </CardHeader>
      <CardContent>
        <p className="-mt-2 mb-5 text-sm text-muted-foreground">
          Controls how <code className="rounded bg-muted px-1 text-xs">/join/{"<slug>"}</code> looks — the page partners see when they use this
          campaign&apos;s link or an invite. Off = the standard Sipfluence look. Turn it on to override.
        </p>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Controls */}
          <div className={`space-y-5 ${b.enabled ? "" : "pointer-events-none opacity-50"}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ColorField label="Primary" value={b.primaryColor} onChange={(v) => set({ primaryColor: v })} />
              <ColorField label="Accent" value={b.accentColor} onChange={(v) => set({ accentColor: v })} />
              <ColorField label="Background" value={b.backgroundColor} onChange={(v) => set({ backgroundColor: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Headline</Label>
              <Input value={b.headline} onChange={(e) => set({ headline: e.target.value })} placeholder={campaignName} />
            </div>
            <div className="space-y-1.5">
              <Label>Subtext</Label>
              <Textarea value={b.subtext} onChange={(e) => set({ subtext: e.target.value })} rows={2} placeholder="A short line under the headline" />
            </div>
            <div className="space-y-1.5">
              <Label>Logo text</Label>
              <Input value={b.logoText} onChange={(e) => set({ logoText: e.target.value })} placeholder="Sipfluence" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(["logoImage", "heroImage"] as const).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label>{k === "logoImage" ? "Logo image" : "Hero image (top banner)"}</Label>
                  {b[k] ? (
                    <div className="flex items-center gap-2 rounded-lg border border-hairline p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b[k]} alt="" className="h-8 w-auto max-w-[80px] object-contain" />
                      <Button type="button" variant="ghost" size="icon-sm" className="ml-auto" onClick={() => set({ [k]: "" } as Partial<CampaignBrand>)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
                      <Upload className="size-3.5" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={onImage(k)} />
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label>Approved message <span className="text-muted-foreground">(shown after they join)</span></Label>
              <Textarea value={b.approvedMessage} onChange={(e) => set({ approvedMessage: e.target.value })} rows={2} placeholder="Welcome aboard! Here's what to do next…" />
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</p>
            <div
              className="relative overflow-hidden rounded-xl border border-hairline"
              style={{ background: bg || "linear-gradient(160deg,#2a0d1e,#140a12)" }}
            >
              {b.heroImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.heroImage} alt="" className="h-16 w-full object-cover" />
              )}
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="text-white">
                  <div className="mb-3 flex items-center gap-2">
                    {b.logoImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.logoImage} alt="" className="h-5 w-auto object-contain" />
                    ) : (
                      <span className="text-sm font-bold">{b.logoText || "Sipfluence"}</span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ color: b.accentColor || "#FFC94D", border: `1px solid ${(b.accentColor || "#FFC94D")}55` }}>
                    <Gift className="size-3" /> Referral program
                  </span>
                  <h3 className="mt-2 text-xl font-semibold leading-tight">{headline}</h3>
                  {subtext && <p className="mt-1 text-xs text-white/70">{subtext}</p>}
                  <div className="mt-3 flex items-center gap-2 text-xs text-white/80">
                    <Zap className="size-3.5" style={{ color: primary }} /> Instant access
                  </div>
                </div>
                <div className="rounded-lg bg-white/10 p-3 backdrop-blur">
                  <div className="mb-2 h-2 w-12 rounded bg-white/30" />
                  <div className="mb-2 h-7 rounded bg-white/15" />
                  <div className="mb-2 h-2 w-16 rounded bg-white/30" />
                  <div className="mb-3 h-7 rounded bg-white/15" />
                  <div className="rounded-md py-2 text-center text-xs font-semibold text-white" style={{ background: primary }}>
                    Join now
                  </div>
                </div>
              </div>
            </div>
            {!b.enabled && <p className="text-xs text-muted-foreground">Custom theme is off — the preview shows what you&apos;d get if you turn it on.</p>}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Palette className="size-4" />} Save appearance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
