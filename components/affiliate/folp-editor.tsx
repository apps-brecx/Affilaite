"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, RotateCcw, Monitor, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FolpView } from "@/components/affiliate/folp-view";
import { FolpControls } from "@/components/affiliate/folp-controls";
import { saveMyFolp, resetMyFolp } from "@/app/actions/folp";
import { mergeFolp, isLocked, type FolpDefault, type FolpTheme, type MergeVars } from "@/lib/folp";

const structuredCopy = (o: any) => JSON.parse(JSON.stringify(o ?? {}));
function withPath(o: any, p: string, v: any) {
  const next = structuredCopy(o);
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
  data: {
    name: string; code: string; shopLink: string; shopLabelOverride: string | null;
    socials: Record<string, string>; logoText: string; logoUrl: string | null; logoDarkUrl: string | null; shopName: string;
  };
}) {
  const [ov, setOv] = useState<Record<string, any>>(initialOverrides ?? {});
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const merged: FolpTheme = useMemo(() => mergeFolp(brand, ov), [brand, ov]);
  const vars: Partial<MergeVars> = { first_name: data.name.split(" ")[0], shop_name: data.shopName, code: data.code, offer: "" };
  const set = (path: string, v: any) => { setOv((o) => withPath(o, path, v)); setDirty(true); };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{dirty ? <span className="text-warning">● Unsaved changes</span> : <span>All changes saved</span>}</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset} disabled={pending}><RotateCcw className="size-4" /> Reset to brand default</Button>
          <Button size="sm" onClick={save} disabled={pending || !dirty}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
        <div className="lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto lg:pr-2">
          <FolpControls theme={merged} layout={merged.layout} set={set} mode="affiliate" isLocked={(p) => isLocked(brand, p)} brandName={data.shopName} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Button variant={device === "desktop" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("desktop")} aria-label="Desktop"><Monitor className="size-4" /></Button>
            <Button variant={device === "mobile" ? "secondary" : "ghost"} size="icon-sm" onClick={() => setDevice("mobile")} aria-label="Mobile"><Smartphone className="size-4" /></Button>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className={`mx-auto ${device === "mobile" ? "max-w-[390px]" : "w-full"}`}>
                <FolpView theme={merged} logoText={data.logoText} logoUrl={data.logoUrl} logoDarkUrl={data.logoDarkUrl}
                  name={data.name} code={data.code} shopLink={data.shopLink} shopLabelOverride={data.shopLabelOverride}
                  socials={data.socials} vars={vars} device={device} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
