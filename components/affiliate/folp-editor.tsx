"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw, Monitor, Smartphone, Lock, Palette, Type, LayoutGrid, TextCursorInput, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { FolpView } from "@/components/affiliate/folp-view";
import { saveMyFolp, resetMyFolp } from "@/app/actions/folp";
import {
  mergeFolp, isLocked, fontStack, FOLP_LAYOUTS, FOLP_FONTS, MERGE_TOKENS,
  type FolpDefault, type FolpTheme, type MergeVars, type FolpLayout,
} from "@/lib/folp";

const get = (o: any, p: string) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function withPath(o: any, p: string, v: any) {
  const next = structuredClone(o ?? {});
  const keys = p.split(".");
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = cur[keys[i]] ?? {}; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = v;
  return next;
}

export function FolpEditor({
  brand, initialOverrides, data,
}: {
  brand: FolpDefault;
  initialOverrides: Record<string, any> | null;
  data: { name: string; code: string; shopLink: string; socials: Record<string, string>; logoText: string; shopName: string };
}) {
  const [ov, setOv] = useState<Record<string, any>>(initialOverrides ?? {});
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const merged: FolpTheme = useMemo(() => mergeFolp(brand, ov), [brand, ov]);
  const vars: MergeVars = { first_name: data.name.split(" ")[0], shop_name: data.shopName, code: data.code, offer: "" };

  const set = (path: string, v: any) => { setOv((o) => withPath(o, path, v)); setDirty(true); };
  const locked = (path: string) => isLocked(brand, path);
  const lockTip = `Managed by ${data.shopName} — can’t be changed.`;

  const save = () => start(async () => {
    const res = await saveMyFolp(ov);
    toast(res.message, res.ok ? "success" : "error");
    if (res.ok) { setDirty(false); router.refresh(); }
  });
  const reset = () => start(async () => {
    const res = await resetMyFolp();
    toast(res.message, res.ok ? "success" : "error");
    if (res.ok) { setOv({}); setDirty(false); router.refresh(); }
  });

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {dirty ? <span className="text-warning">● Unsaved changes</span> : <span>All changes saved</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={pending}><RotateCcw className="size-4" /> Reset to brand default</Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ---------- Controls ---------- */}
        <div className="space-y-5 lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pr-2">
          {/* Layout */}
          <Section icon={LayoutGrid} title="Layout">
            <LockRow locked={locked("layout")} tip={lockTip}>
              <div className="grid grid-cols-2 gap-2">
                {FOLP_LAYOUTS.map((l) => (
                  <button key={l.value} type="button" disabled={locked("layout")}
                    onClick={() => set("layout", l.value)}
                    className={`rounded-xl border p-3 text-left text-xs transition-colors disabled:opacity-50 ${merged.layout === l.value ? "border-primary bg-primary/10" : "border-hairline hover:border-primary/40"}`}>
                    <p className="font-semibold">{l.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{l.desc}</p>
                  </button>
                ))}
              </div>
            </LockRow>
          </Section>

          {/* Colors */}
          <Section icon={Palette} title="Colors">
            {([
              ["styles.primaryColor", "Primary"], ["styles.headingColor", "Heading"], ["styles.textColor", "Text"],
              ["styles.backgroundColor", "Background"], ["styles.accentColor", "Accent"], ["styles.cardColor", "Card"],
            ] as const).map(([path, label]) => (
              <LockRow key={path} locked={locked(path)} tip={lockTip}>
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={get(merged, path)} disabled={locked(path)}
                      onChange={(e) => set(path, e.target.value)} className="size-8 cursor-pointer rounded border border-hairline bg-transparent disabled:opacity-50" />
                    <Input value={get(merged, path)} disabled={locked(path)} onChange={(e) => set(path, e.target.value)} className="h-8 w-24 font-mono text-xs" />
                  </div>
                </div>
              </LockRow>
            ))}
          </Section>

          {/* Typography */}
          <Section icon={Type} title="Typography">
            {([["styles.headingFont", "Heading font"], ["styles.bodyFont", "Body font"]] as const).map(([path, label]) => (
              <LockRow key={path} locked={locked(path)} tip={lockTip}>
                <div className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <select value={get(merged, path)} disabled={locked(path)} onChange={(e) => set(path, e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle disabled:opacity-50"
                    style={{ fontFamily: fontStack(get(merged, path)) }}>
                    {FOLP_FONTS.map((f) => <option key={f.value} value={f.value} style={{ fontFamily: f.stack }}>{f.label}</option>)}
                  </select>
                </div>
              </LockRow>
            ))}
          </Section>

          {/* Content */}
          <Section icon={TextCursorInput} title="Content">
            <TextField path="content.headline" label="Headline" merged={merged} locked={locked("content.headline")} tip={lockTip} set={set} />
            <TextField path="content.description" label="Description" merged={merged} locked={locked("content.description")} tip={lockTip} set={set} textarea />
            <MergeHint />
            <TextField path="content.shopLabel" label="Shop button label" merged={merged} locked={locked("content.shopLabel")} tip={lockTip} set={set} />
            <TextField path="content.couponLabel" label="Coupon label" merged={merged} locked={locked("content.couponLabel")} tip={lockTip} set={set} />
            <TextField path="content.heroImageUrl" label="Hero image URL" merged={merged} locked={locked("content.heroImageUrl")} tip={lockTip} set={set} placeholder="https://…/photo.jpg" />
            <TextField path="content.footerText" label="Footer text" merged={merged} locked={locked("content.footerText")} tip={lockTip} set={set} />
          </Section>

          {/* Visibility */}
          <Section icon={Eye} title="Show / hide">
            {([
              ["visibility.showLogo", "Brand logo"], ["visibility.showHero", "Hero image"], ["visibility.showCoupon", "Coupon code"],
              ["visibility.showSocials", "Social links"], ["visibility.showTerms", "Terms / expiry"],
            ] as const).map(([path, label]) => (
              <LockRow key={path} locked={locked(path)} tip={lockTip}>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs">{label}</span>
                  <input type="checkbox" checked={!!get(merged, path)} disabled={locked(path)} onChange={(e) => set(path, e.target.checked)} className="size-4 accent-[var(--primary,#FF5C9E)] disabled:opacity-50" />
                </label>
              </LockRow>
            ))}
          </Section>
        </div>

        {/* ---------- Preview ---------- */}
        <div>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")} aria-label="Desktop"><Monitor className="size-4" /></Button>
            <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")} aria-label="Mobile"><Smartphone className="size-4" /></Button>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className={`mx-auto ${device === "mobile" ? "max-w-[390px]" : "w-full"}`}>
                <FolpView theme={merged} logoText={data.logoText} name={data.name} code={data.code} shopLink={data.shopLink} socials={data.socials} vars={vars} device={device} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" /> {title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function LockRow({ locked, tip, children }: { locked: boolean; tip: string; children: React.ReactNode }) {
  return (
    <div className={locked ? "relative opacity-70" : ""} title={locked ? tip : undefined}>
      {children}
      {locked && <span className="pointer-events-none absolute right-0 top-0 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Lock className="size-3" /></span>}
    </div>
  );
}

function TextField({ path, label, merged, locked, tip, set, textarea, placeholder }: {
  path: string; label: string; merged: any; locked: boolean; tip: string; set: (p: string, v: any) => void; textarea?: boolean; placeholder?: string;
}) {
  const v = get(merged, path) ?? "";
  return (
    <LockRow locked={locked} tip={tip}>
      <div className="space-y-1.5">
        <Label className="text-xs">{label}</Label>
        {textarea
          ? <Textarea value={v} disabled={locked} onChange={(e) => set(path, e.target.value)} rows={3} placeholder={placeholder} />
          : <Input value={v} disabled={locked} onChange={(e) => set(path, e.target.value)} placeholder={placeholder} className="h-9" />}
      </div>
    </LockRow>
  );
}

function MergeHint() {
  return (
    <p className="-mt-1 text-[11px] text-muted-foreground">
      Insert variables: {MERGE_TOKENS.map((t) => <code key={t.token} className="mx-0.5 rounded bg-muted px-1">{t.token}</code>)}
    </p>
  );
}

// keep the FolpLayout import referenced for typing
export type { FolpLayout };
