"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Lock, LockOpen, Monitor, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { FolpView } from "@/components/affiliate/folp-view";
import { saveFolpDefault } from "@/app/actions/admin";
import { fontStack, FOLP_LAYOUTS, FOLP_FONTS, FOLP_FIELDS, type FolpDefault } from "@/lib/folp";

const get = (o: any, p: string) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
function withPath(o: any, p: string, v: any) {
  const next = structuredClone(o);
  const keys = p.split(".");
  let cur = next;
  for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = cur[keys[i]] ?? {}; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = v;
  return next;
}

export function FolpAdminEditor({ initial, brandName }: { initial: FolpDefault; brandName: string }) {
  const [theme, setTheme] = useState<FolpDefault>(initial);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const locked = useMemo(() => new Set(theme.lockedFields ?? []), [theme.lockedFields]);
  const set = (path: string, v: any) => setTheme((t) => withPath(t, path, v));
  const toggleLock = (path: string) =>
    setTheme((t) => {
      const s = new Set(t.lockedFields ?? []);
      s.has(path) ? s.delete(path) : s.add(path);
      return { ...t, lockedFields: [...s] };
    });

  const save = () => start(async () => {
    const res = await saveFolpDefault(theme);
    toast(res.message, res.ok ? "success" : "error");
    if (res.ok) router.refresh();
  });

  const LockBtn = ({ path }: { path: string }) => (
    <button type="button" onClick={() => toggleLock(path)} title={locked.has(path) ? "Locked — affiliates can't change this" : "Unlocked — affiliates can override"}
      className={`inline-flex size-6 shrink-0 items-center justify-center rounded ${locked.has(path) ? "bg-danger-soft text-danger" : "text-muted-foreground hover:bg-muted"}`}>
      {locked.has(path) ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Edit the default every affiliate starts from. Lock any field to stop affiliates changing it.</p>
        <Button size="sm" onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save default</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="space-y-5 lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto lg:pr-2">
          <Group title="Layout">
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-2">
                {FOLP_LAYOUTS.map((l) => (
                  <button key={l.value} type="button" onClick={() => set("layout", l.value)}
                    className={`rounded-xl border p-2.5 text-left text-xs ${theme.layout === l.value ? "border-primary bg-primary/10" : "border-hairline"}`}>
                    <p className="font-semibold">{l.label}</p>
                  </button>
                ))}
              </div>
              <LockBtn path="layout" />
            </div>
          </Group>

          <Group title="Colors">
            {([["styles.primaryColor","Primary"],["styles.headingColor","Heading"],["styles.textColor","Text"],["styles.backgroundColor","Background"],["styles.accentColor","Accent"],["styles.cardColor","Card"]] as const).map(([path,label]) => (
              <div key={path} className="flex items-center justify-between gap-2">
                <Label className="text-xs">{label}</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={get(theme, path)} onChange={(e) => set(path, e.target.value)} className="size-8 cursor-pointer rounded border border-hairline bg-transparent" />
                  <Input value={get(theme, path)} onChange={(e) => set(path, e.target.value)} className="h-8 w-24 font-mono text-xs" />
                  <LockBtn path={path} />
                </div>
              </div>
            ))}
          </Group>

          <Group title="Typography">
            {([["styles.headingFont","Heading font"],["styles.bodyFont","Body font"]] as const).map(([path,label]) => (
              <div key={path} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <select value={get(theme, path)} onChange={(e) => set(path, e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm" style={{ fontFamily: fontStack(get(theme, path)) }}>
                    {FOLP_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <LockBtn path={path} />
              </div>
            ))}
          </Group>

          <Group title="Content">
            {([["content.headline","Headline",false],["content.description","Description",true],["content.shopLabel","Shop button",false],["content.couponLabel","Coupon label",false],["content.heroImageUrl","Hero image URL",false],["content.footerText","Footer",false]] as const).map(([path,label,ta]) => (
              <div key={path} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  {ta ? <Textarea value={get(theme, path)} onChange={(e) => set(path, e.target.value)} rows={2} /> : <Input value={get(theme, path)} onChange={(e) => set(path, e.target.value)} className="h-9" />}
                </div>
                <LockBtn path={path} />
              </div>
            ))}
          </Group>

          <Group title="Show / hide">
            {([["visibility.showLogo","Brand logo"],["visibility.showHero","Hero image"],["visibility.showCoupon","Coupon"],["visibility.showSocials","Socials"],["visibility.showTerms","Terms"]] as const).map(([path,label]) => (
              <div key={path} className="flex items-center justify-between gap-2">
                <span className="text-xs">{label}</span>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!get(theme, path)} onChange={(e) => set(path, e.target.checked)} className="size-4 accent-[#FF5C9E]" />
                  <LockBtn path={path} />
                </div>
              </div>
            ))}
          </Group>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")}><Monitor className="size-4" /></Button>
            <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")}><Smartphone className="size-4" /></Button>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className={`mx-auto ${device === "mobile" ? "max-w-[390px]" : "w-full"}`}>
                <FolpView theme={theme} logoText={brandName} name="Jordan Rivera" code="JORDAN10" shopLink="#"
                  socials={{ instagram: "@jordan", youtube: "jordan" }}
                  vars={{ first_name: "Jordan", shop_name: brandName, code: "JORDAN10", offer: "10% off" }} device={device} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline p-4">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// referenced so the field list stays in sync with lockable paths
export const _FIELDS = FOLP_FIELDS;
