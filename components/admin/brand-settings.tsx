"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Palette, Loader2, Save, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveBrand } from "@/app/actions/admin";
import type { BrandSettings } from "@/lib/campaign-config";

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
    </div>
  );
}

export function BrandSettingsCard({ brand }: { brand: BrandSettings }) {
  const [b, setB] = useState<BrandSettings>(brand);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const set = (patch: Partial<BrandSettings>) => setB((prev) => ({ ...prev, ...patch }));

  const save = () =>
    start(async () => {
      const res = await saveBrand(b);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Palette className="size-4 text-primary" /> Brand &amp; theme
        </CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Style the pages partners see — signup, login, and the approved screen. Applied everywhere they land.
          </p>
          <div className="space-y-1.5">
            <Label>Brand name (wordmark)</Label>
            <Input value={b.logoText} onChange={(e) => set({ logoText: e.target.value })} placeholder="Sipfluence" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Primary color" value={b.primaryColor} onChange={(v) => set({ primaryColor: v })} />
            <ColorField label="Accent color" value={b.accentColor} onChange={(v) => set({ accentColor: v })} />
          </div>
          <div className="space-y-1.5">
            <Label>Signup headline</Label>
            <Input value={b.signupHeadline} onChange={(e) => set({ signupHeadline: e.target.value })} placeholder="Defaults to the campaign name" />
          </div>
          <div className="space-y-1.5">
            <Label>Signup subtext</Label>
            <Textarea value={b.signupSubtext} onChange={(e) => set({ signupSubtext: e.target.value })} placeholder="A short welcome line under the headline" />
          </div>
          <div className="space-y-1.5">
            <Label>Approved message</Label>
            <Textarea value={b.approvedMessage} onChange={(e) => set({ approvedMessage: e.target.value })} placeholder="Shown after someone joins instantly" />
          </div>
        </div>

        {/* Live preview */}
        <div>
          <Label className="mb-2 block">Preview</Label>
          <div
            className="overflow-hidden rounded-xl border border-hairline"
            style={{ ["--brand" as any]: b.primaryColor, ["--brand-accent" as any]: b.accentColor }}
          >
            <div className="flex items-center justify-between border-b border-hairline bg-muted/30 px-4 py-3">
              <span className="flex items-center gap-2 font-display text-base font-semibold">
                <span className="flex size-6 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: b.primaryColor }}>
                  {(b.logoText || "S").charAt(0)}
                </span>
                {b.logoText || "Sipfluence"}
              </span>
              <span className="text-xs" style={{ color: b.accentColor }}>Partner program</span>
            </div>
            <div className="space-y-3 p-5">
              <h3 className="font-display text-xl font-semibold">{b.signupHeadline || "Summer Creators"}</h3>
              <p className="text-sm text-muted-foreground">{b.signupSubtext || "Share what you love and earn on every sale."}</p>
              <div className="h-9 rounded-md bg-muted" />
              <button
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-md py-2.5 text-sm font-medium text-white"
                style={{ background: b.primaryColor }}
              >
                Join now <ExternalLink className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
