"use client";

import { useState, useTransition } from "react";
import { Loader2, Save, Palette } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveEmailBrand } from "@/app/actions/email-center";
import type { EmailBrand } from "@/lib/email-center";

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#FF5C9E";
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 shrink-0 cursor-pointer rounded-md border border-hairline bg-background p-0.5"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#FF5C9E" className="font-mono" />
      </div>
    </div>
  );
}

export function EmailBrandingCard({ brand }: { brand: EmailBrand }) {
  const [logoText, setLogoText] = useState(brand.logoText);
  const [logoUrl, setLogoUrl] = useState(brand.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(brand.primaryColor);
  const [buttonColor, setButtonColor] = useState(brand.buttonColor);
  const [footerText, setFooterText] = useState(brand.footerText);
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await saveEmailBrand({ logoText, logoUrl, primaryColor, buttonColor, footerText });
      toast(res.message, res.ok ? "success" : "error");
    });

  return (
    <details className="group rounded-xl border border-hairline bg-card" open>
      <summary className="flex cursor-pointer items-center gap-2 p-4 font-medium">
        <Palette className="size-4 text-primary" /> Global branding &amp; footer
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Logo, colours, footer</span>
      </summary>
      <div className="border-t border-hairline p-5">
        <p className="mb-4 text-sm text-muted-foreground">These apply to <span className="font-medium text-foreground">every</span> email — automatic, broadcasts, and invites. Per-email settings can override the button colour.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Logo text</Label>
            <Input value={logoText} onChange={(e) => setLogoText(e.target.value)} maxLength={60} placeholder="Sipfluence" />
          </div>
          <div className="space-y-1.5">
            <Label>Logo image URL (optional)</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} maxLength={1000} placeholder="https://cdn.yourstore.com/logo.png" />
            <p className="text-[11px] text-muted-foreground">When set, the image replaces the text logo (shown ~34px tall).</p>
          </div>
          <ColorField label="Brand colour (logo & accents)" value={primaryColor} onChange={setPrimaryColor} />
          <ColorField label="Button colour" value={buttonColor} onChange={setButtonColor} />
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Footer (every email)</Label>
            <Textarea value={footerText} onChange={(e) => setFooterText(e.target.value)} rows={2} maxLength={600} placeholder="You're receiving this because you're a {{logo}} partner." />
            <p className="text-[11px] text-muted-foreground">Use <code className="font-mono">{"{{logo}}"}</code> for your brand name. Leave blank to hide the footer.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save branding
          </Button>
        </div>
      </div>
    </details>
  );
}
