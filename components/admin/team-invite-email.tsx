"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Loader2, Save, Upload, X, Braces } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveTeamInviteEmail } from "@/app/actions/team";
import type { TeamInviteEmail } from "@/lib/email-center";

const VARS = ["{{name}}", "{{email}}", "{{tempPassword}}", "{{loginUrl}}", "{{brand}}"];
const MAX_IMG = 2.4 * 1024 * 1024;

// Sample values so the live preview reads like a real email.
const SAMPLE: Record<string, string> = {
  name: "Alex",
  email: "alex@example.com",
  tempPassword: "Sip-7K2QMX",
  loginUrl: "#",
  brand: "",
};
const fill = (s: string, brand: string) =>
  s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k === "brand" ? brand : SAMPLE[k] ?? `{{${k}}}`));

export function TeamInviteEmailBuilder({
  template,
  brand,
}: {
  template: TeamInviteEmail;
  brand: { logoText: string; logoUrl: string; primaryColor: string; footerText: string };
}) {
  const [t, setT] = useState<TeamInviteEmail>(template);
  const [activeField, setActiveField] = useState<"subject" | "body" | "preheader">("body");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const imgRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<TeamInviteEmail>) => setT((p) => ({ ...p, ...patch }));

  const insertVar = (v: string) => set({ [activeField]: (t[activeField] || "") + v } as Partial<TeamInviteEmail>);

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast("Choose an image file.", "error");
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (url.length > MAX_IMG) return toast("Image is too large — pick one under ~1.8MB.", "error");
      set({ imageUrl: url });
    };
    reader.readAsDataURL(file);
  };

  const save = () =>
    start(async () => {
      const res = await saveTeamInviteEmail(t);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  const brandName = brand.logoText || "Sipfluence";
  const btnColor = /^#[0-9a-f]{6}$/i.test(t.buttonColor) ? t.buttonColor : brand.primaryColor || "#FF5C9E";
  const previewBody = fill(t.body, brandName).split(/\n{2,}/);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Controls */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Mail className="size-4 text-primary" /> Team invite email</CardTitle>
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This is the email new team members get when you invite them from{" "}
            <a href="/admin/settings/team" className="font-medium text-primary hover:underline">Team &amp; access</a>. The
            logo and footer come from your <a href="/admin/settings/brand" className="font-medium text-primary hover:underline">email branding</a>.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sender name</Label>
              <Input value={t.fromName} onChange={(e) => set({ fromName: e.target.value })} placeholder={brandName} />
            </div>
            <div className="space-y-1.5">
              <Label>Button color</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={btnColor} onChange={(e) => set({ buttonColor: e.target.value })} className="size-10 shrink-0 cursor-pointer rounded-md border border-hairline bg-transparent p-0.5" />
                <Input value={t.buttonColor} onChange={(e) => set({ buttonColor: e.target.value })} className="font-mono" placeholder="brand default" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={t.subject} onFocus={() => setActiveField("subject")} onChange={(e) => set({ subject: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Preview text (preheader)</Label>
            <Input value={t.preheader} onFocus={() => setActiveField("preheader")} onChange={(e) => set({ preheader: e.target.value })} placeholder="Shown in the inbox preview line" />
          </div>

          <div className="space-y-1.5">
            <Label>Body</Label>
            <Textarea value={t.body} onFocus={() => setActiveField("body")} onChange={(e) => set({ body: e.target.value })} rows={7} />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Braces className="size-3" /> Insert into {activeField}:</span>
              {VARS.map((v) => (
                <button type="button" key={v} onClick={() => insertVar(v)} className="kbd hover:bg-accent">{v}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Button label</Label>
              <Input value={t.buttonLabel} onChange={(e) => set({ buttonLabel: e.target.value })} placeholder="Sign in" />
            </div>
            <div className="space-y-1.5">
              <Label>Button link</Label>
              <Input value={t.buttonUrl} onChange={(e) => set({ buttonUrl: e.target.value })} placeholder="{{loginUrl}}" />
            </div>
          </div>

          <div className="rounded-xl border border-hairline p-4">
            <p className="mb-1 text-sm font-medium">Login screen greeting</p>
            <p className="mb-3 text-xs text-muted-foreground">Shown on the sign-in page when an invited member clicks the button (instead of &ldquo;Welcome back&rdquo;).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Headline</Label>
                <Input value={t.loginHeadline} onChange={(e) => set({ loginHeadline: e.target.value })} placeholder="Welcome" />
              </div>
              <div className="space-y-1.5">
                <Label>Subtext</Label>
                <Input value={t.loginSubtext} onChange={(e) => set({ loginSubtext: e.target.value })} placeholder="Sign in to get started." />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Header image (optional)</Label>
            {t.imageUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.imageUrl} alt="" className="h-20 rounded-lg border border-hairline object-cover" />
                <button onClick={() => set({ imageUrl: "" })} className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-danger text-danger-foreground"><X className="size-3" /></button>
              </div>
            ) : (
              <button onClick={() => imgRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline py-5 text-sm text-muted-foreground hover:bg-accent/40">
                <Upload className="size-4" /> Upload
              </button>
            )}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <Label className="mb-2 block">Live preview</Label>
        <div className="overflow-hidden rounded-xl border border-hairline">
          <div className="border-b border-hairline bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">From:</span> {t.fromName || brandName}</p>
            <p className="truncate"><span className="font-medium text-foreground">Subject:</span> {fill(t.subject, brandName) || "(no subject)"}</p>
          </div>
          <div className="mx-auto max-w-[520px] bg-[#FFF7F1] px-6 py-7">
            {brand.logoUrl && /^https?:\/\//.test(brand.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="mb-5 h-8 object-contain" />
            ) : (
              <div className="mb-5 text-xl font-extrabold" style={{ color: brand.primaryColor || "#FF5C9E" }}>{brandName}</div>
            )}
            {t.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.imageUrl} alt="" className="mb-4 w-full rounded-xl object-cover" />
            )}
            {previewBody.map((p, i) => (
              <p key={i} className="mb-3 whitespace-pre-wrap text-[15px] leading-relaxed text-[#1a1a17]">{p}</p>
            ))}
            {t.buttonLabel && (
              <span className="mt-1 inline-block rounded-xl px-6 py-3 text-[15px] font-semibold text-white" style={{ background: btnColor }}>{t.buttonLabel}</span>
            )}
            {brand.footerText && (
              <>
                <hr className="my-5 border-t border-[#efe4da]" />
                <p className="whitespace-pre-wrap text-xs text-[#9a8f86]">{brand.footerText.replace(/\{\{logo\}\}/g, brandName)}</p>
              </>
            )}
          </div>
        </div>

        {/* Login screen preview — what invited members see when they click through */}
        <Label className="mb-2 mt-6 block">Login screen preview</Label>
        <div className="overflow-hidden rounded-xl border border-hairline bg-[#FFF7F1]">
          <div className="flex flex-col items-center px-6 py-8 text-center">
            {brand.logoUrl && /^https?:\/\//.test(brand.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="mb-5 h-8 object-contain" />
            ) : (
              <div className="mb-5 text-lg font-extrabold" style={{ color: brand.primaryColor || "#FF5C9E" }}>{brandName}</div>
            )}
            <p className="font-display text-xl font-semibold text-[#1a1a17]">{t.loginHeadline?.trim() || "Welcome"}</p>
            <p className="mt-1 text-sm text-[#7a7168]">{t.loginSubtext?.trim() || `Sign in to the ${brandName} partner portal.`}</p>
            <div className="mt-5 w-full max-w-[280px] space-y-2.5 rounded-xl border border-[#efe4da] bg-white p-4 text-left">
              <div>
                <p className="mb-1 text-[11px] font-medium text-[#7a7168]">Email</p>
                <div className="h-8 rounded-md border border-[#efe4da] bg-[#FFF7F1]" />
              </div>
              <div>
                <p className="mb-1 text-[11px] font-medium text-[#7a7168]">Password</p>
                <div className="h-8 rounded-md border border-[#efe4da] bg-[#FFF7F1]" />
              </div>
              <div className="h-9 rounded-lg" style={{ background: brand.primaryColor || "#FF5C9E" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
