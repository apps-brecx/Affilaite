"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, ChevronUp, ChevronDown, Loader2, Save, Image as ImageIcon, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveSamplesConfig, saveBanner } from "@/app/actions/admin";
import type { Banner } from "@/lib/queries";

interface P { id: string; title: string; image: string | null; available: boolean }

export function SamplesSettings({
  products,
  order,
  shown,
  banner,
}: {
  products: P[];
  order: string[];
  shown: string[];
  banner: Banner | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  // Curation state: ordered list of product ids + a visible set.
  const byId = new Map(products.map((p) => [p.id, p]));
  const initialOrder = [...order.filter((id) => byId.has(id)), ...products.map((p) => p.id).filter((id) => !order.includes(id))];
  const [ids, setIds] = useState<string[]>(initialOrder);
  const [visible, setVisible] = useState<Set<string>>(new Set(shown.length ? shown : products.map((p) => p.id)));

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

  const saveCuration = () =>
    start(async () => {
      const res = await saveSamplesConfig({ order: ids, shown: [...visible] });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  // Banner state.
  const [b, setB] = useState({
    enabled: banner?.enabled ?? false,
    title: banner?.title ?? "",
    body: banner?.body ?? "",
    ctaLabel: banner?.ctaLabel ?? "",
    ctaUrl: banner?.ctaUrl ?? "",
    imageUrl: banner?.imageUrl ?? "",
  });
  const saveBn = () =>
    start(async () => {
      const res = await saveBanner("samples", b);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Curation */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-primary" /> Sample catalog</CardTitle>
          <Button size="sm" onClick={saveCuration} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">Choose which products affiliates can request, and their order. Out-of-stock items still sink to the bottom for affiliates.</p>
          {products.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No products from Shopify yet.</p>
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

      {/* Banner */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><ImageIcon className="size-4 text-primary" /> Samples banner</CardTitle>
          <Button size="sm" onClick={saveBn} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Switch checked={b.enabled} onCheckedChange={(v) => setB({ ...b, enabled: v })} label="Show banner" description="Affiliates see nothing here when this is off." />
          <div className="space-y-1.5"><Label>Title</Label><Input value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder="New drop just landed" /></div>
          <div className="space-y-1.5"><Label>Message</Label><Textarea value={b.body} onChange={(e) => setB({ ...b, body: e.target.value })} rows={2} placeholder="Request a sample and start posting." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5"><Label>Button text</Label><Input value={b.ctaLabel} onChange={(e) => setB({ ...b, ctaLabel: e.target.value })} placeholder="Optional" /></div>
            <div className="space-y-1.5"><Label>Button URL</Label><Input value={b.ctaUrl} onChange={(e) => setB({ ...b, ctaUrl: e.target.value })} placeholder="https://" /></div>
          </div>
          <div className="space-y-1.5"><Label>Image URL (optional)</Label><Input value={b.imageUrl} onChange={(e) => setB({ ...b, imageUrl: e.target.value })} placeholder="https://…" /></div>
        </CardContent>
      </Card>
    </div>
  );
}
