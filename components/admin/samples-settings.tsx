"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, ChevronUp, ChevronDown, Loader2, Save, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveSamplesConfig, saveBanner } from "@/app/actions/admin";
import type { Banner } from "@/lib/queries";

interface P { id: string; title: string; image: string | null; available: boolean }

/** Which products (from the promotions catalog) affiliates can sample, + order. */
export function SamplesCuration({ products, order, shown }: { products: P[]; order: string[]; shown: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const byId = new Map(products.map((p) => [p.id, p]));
  const initialOrder = [...order.filter((id) => byId.has(id)), ...products.map((p) => p.id).filter((id) => !order.includes(id))];
  const [ids, setIds] = useState<string[]>(initialOrder);
  const [visible, setVisible] = useState<Set<string>>(new Set(shown.length ? shown.filter((id) => byId.has(id)) : products.map((p) => p.id)));

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j], next[i]];
    setIds(next);
  };
  const toggle = (id: string) =>
    setVisible((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const save = () =>
    start(async () => {
      const res = await saveSamplesConfig({ order: ids, shown: [...visible] });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Gift className="size-4 text-primary" /> Sample catalog</CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">These are the products shown to affiliates in Promotions. Pick which can be sampled and their order; out-of-stock items sink to the bottom for affiliates.</p>
        {products.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No products are visible in Promotions yet — add some there first.</p>
        ) : (
          <div className="max-h-96 space-y-1.5 overflow-y-auto no-scrollbar">
            {ids.map((id, i) => {
              const p = byId.get(id);
              if (!p) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg border border-hairline p-2">
                  <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="size-full object-cover" />
                    ) : (
                      <Gift className="size-4 text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.title}</p>
                    {!p.available && <p className="text-[11px] text-danger">Out of stock</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"><ChevronUp className="size-4" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === ids.length - 1} className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"><ChevronDown className="size-4" /></button>
                  </div>
                  <Switch checked={visible.has(id)} onCheckedChange={() => toggle(id)} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MAX_IMG = 1.8 * 1024 * 1024; // ~1.8MB after base64

export function SamplesBanner({ banner }: { banner: Banner | null }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [b, setB] = useState({
    enabled: banner?.enabled ?? false,
    title: banner?.title ?? "",
    body: banner?.body ?? "",
    ctaLabel: banner?.ctaLabel ?? "",
    ctaUrl: banner?.ctaUrl ?? "",
    imageUrl: banner?.imageUrl ?? "",
  });

  const pickImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("Choose an image file.", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      if (dataUrl.length > MAX_IMG) { toast("Image is too large — pick one under ~1.3MB.", "error"); return; }
      setB((v) => ({ ...v, imageUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const save = () =>
    start(async () => {
      const res = await saveBanner("samples", b);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2"><Upload className="size-4 text-primary" /> Samples banner</CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <Switch checked={b.enabled} onCheckedChange={(v) => setB({ ...b, enabled: v })} label="Show banner" description="Affiliates see nothing here when this is off." />
        <div className="space-y-1.5"><Label>Title</Label><Input value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder="New drop just landed" /></div>
        <div className="space-y-1.5"><Label>Message</Label><Textarea value={b.body} onChange={(e) => setB({ ...b, body: e.target.value })} rows={2} placeholder="Request a sample and start posting." /></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label>Button text</Label><Input value={b.ctaLabel} onChange={(e) => setB({ ...b, ctaLabel: e.target.value })} placeholder="Optional" /></div>
          <div className="space-y-1.5"><Label>Button URL</Label><Input value={b.ctaUrl} onChange={(e) => setB({ ...b, ctaUrl: e.target.value })} placeholder="https://" /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Banner image</Label>
          {b.imageUrl ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt="" className="h-24 rounded-lg border border-hairline object-cover" />
              <button onClick={() => setB({ ...b, imageUrl: "" })} className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-danger text-danger-foreground"><X className="size-3" /></button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hairline py-6 text-sm text-muted-foreground hover:bg-accent/40"
            >
              <Upload className="size-4" /> Upload an image
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
        </div>
      </CardContent>
    </Card>
  );
}
