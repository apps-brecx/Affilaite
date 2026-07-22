"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Monitor, Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { FolpView } from "@/components/affiliate/folp-view";
import { FolpControls } from "@/components/affiliate/folp-controls";
import { saveFolpDefault } from "@/app/actions/admin";
import type { FolpDefault } from "@/lib/folp";

function withPath(o: any, p: string, v: any) {
  const next = JSON.parse(JSON.stringify(o));
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

  const set = (path: string, v: any) => setTheme((t) => withPath(t, path, v));
  const isLocked = (path: string) => (theme.lockedFields ?? []).includes(path);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Edit the default every affiliate starts from. 🔒 locks a field so affiliates can&apos;t change it.</p>
        <Button size="sm" onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save default</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="lg:max-h-[calc(100vh-13rem)] lg:overflow-y-auto lg:pr-2">
          <FolpControls theme={theme} layout={theme.layout} set={set} mode="admin" isLocked={isLocked} onToggleLock={toggleLock} brandName={brandName} />
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
