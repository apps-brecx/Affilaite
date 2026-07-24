"use client";

import { Lock, LockOpen, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { fontStack, FOLP_LAYOUTS, FOLP_FONTS, FOLP_FIELDS, MERGE_TOKENS, REPEATER_MAX, type FolpLayout } from "@/lib/folp";

const get = (o: any, p: string) => p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);

// Item sub-fields for each repeater kind.
const REPEATER_ITEMS: Record<string, { key: string; label: string; ta?: boolean; img?: boolean }[]> = {
  products: [{ key: "image", label: "Image", img: true }, { key: "name", label: "Name" }, { key: "price", label: "Price" }, { key: "salePrice", label: "Sale price" }],
  testimonials: [{ key: "quote", label: "Quote", ta: true }, { key: "name", label: "Name" }, { key: "avatar", label: "Avatar", img: true }],
  quiz: [{ key: "label", label: "Answer" }, { key: "resultTitle", label: "Result title" }, { key: "resultDesc", label: "Result description", ta: true }, { key: "image", label: "Product image", img: true }],
};
const REPEATER_KEY: Record<string, keyof typeof REPEATER_MAX> = { products: "products", testimonials: "testimonials", quiz: "quizAnswers" };

export function FolpControls({
  theme, layout, set, mode, isLocked, onToggleLock, brandName,
}: {
  theme: any; layout: FolpLayout; set: (path: string, v: any) => void;
  mode: "affiliate" | "admin"; isLocked: (path: string) => boolean;
  onToggleLock?: (path: string) => void; brandName: string;
}) {
  const groups = [...new Set(FOLP_FIELDS.map((f) => f.group))];
  const tip = `Managed by ${brandName} — can’t be changed.`;

  const LockCtl = ({ path }: { path: string }) => {
    if (mode === "admin") {
      return (
        <button type="button" onClick={() => onToggleLock?.(path)} title={isLocked(path) ? "Locked — affiliates can't change this" : "Unlocked"}
          className={`inline-flex size-6 shrink-0 items-center justify-center rounded ${isLocked(path) ? "bg-danger-soft text-danger" : "text-muted-foreground hover:bg-muted"}`}>
          {isLocked(path) ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
        </button>
      );
    }
    return isLocked(path) ? <Lock className="size-3 shrink-0 text-muted-foreground" /> : null;
  };

  const control = (f: (typeof FOLP_FIELDS)[number]) => {
    const disabled = mode === "affiliate" && isLocked(f.path);
    const val = get(theme, f.path);
    switch (f.kind) {
      case "layout":
        return (
          <div className="grid grid-cols-2 gap-2">
            {FOLP_LAYOUTS.map((l) => (
              <button key={l.value} type="button" disabled={disabled} onClick={() => set("layout", l.value)}
                className={`rounded-xl border p-2.5 text-left text-xs transition-colors disabled:opacity-50 ${theme.layout === l.value ? "border-primary bg-primary/10" : "border-hairline hover:border-primary/40"}`}>
                <p className="font-semibold">{l.label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{l.desc}</p>
              </button>
            ))}
          </div>
        );
      case "color":
        return (
          <div className="flex items-center gap-2">
            <input type="color" value={val} disabled={disabled} onChange={(e) => set(f.path, e.target.value)} className="size-8 cursor-pointer rounded border border-hairline bg-transparent disabled:opacity-50" />
            <Input value={val} disabled={disabled} onChange={(e) => set(f.path, e.target.value)} className="h-8 w-24 font-mono text-xs" />
          </div>
        );
      case "number": {
        const max = f.path.endsWith("overlayOpacity") ? 90 : 28;
        return (
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={max} value={Number(val) || 0} disabled={disabled} onChange={(e) => set(f.path, Number(e.target.value))} className="flex-1 accent-[#FF5C9E] disabled:opacity-50" />
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Number(val) || 0}{f.path.endsWith("Opacity") ? "%" : "px"}</span>
          </div>
        );
      }
      case "font":
        return (
          <select value={val} disabled={disabled} onChange={(e) => set(f.path, e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50" style={{ fontFamily: fontStack(val) }}>
            {FOLP_FONTS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </select>
        );
      case "bool":
        return <input type="checkbox" checked={!!val} disabled={disabled} onChange={(e) => set(f.path, e.target.checked)} className="size-4 accent-[#FF5C9E] disabled:opacity-50" />;
      case "textarea":
        return <Textarea value={val ?? ""} disabled={disabled} onChange={(e) => set(f.path, e.target.value)} rows={2} />;
      case "image":
        return <ImageUpload value={val ?? ""} disabled={disabled} onChange={(url) => set(f.path, url)} />;
      case "products": case "testimonials": case "quiz":
        return <Repeater kind={f.kind} items={Array.isArray(val) ? val : []} disabled={disabled} onChange={(next) => set(f.path, next)} />;
      default:
        return <Input value={val ?? ""} disabled={disabled} onChange={(e) => set(f.path, e.target.value)} className="h-9" placeholder={f.kind === "url" ? "https://…" : undefined} />;
    }
  };

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const fields = FOLP_FIELDS.filter((f) => f.group === group && (!f.layouts || f.layouts.includes(layout)));
        if (!fields.length) return null;
        return (
          <div key={group} className="rounded-xl border border-hairline p-4">
            <p className="mb-3 text-sm font-semibold">{group}</p>
            <div className="space-y-3">
              {fields.map((f) => {
                const inline = f.kind === "color" || f.kind === "bool";
                const full = f.kind === "products" || f.kind === "testimonials" || f.kind === "quiz" || f.kind === "layout";
                return (
                  <div key={f.path} className={inline ? "flex items-center justify-between gap-2" : "space-y-1.5"}>
                    <div className={inline ? "" : "flex items-center justify-between gap-2"}>
                      <Label className="text-xs">{f.label}</Label>
                      {!inline && !full && <LockCtl path={f.path} />}
                    </div>
                    {inline ? (
                      <div className="flex items-center gap-2">{control(f)}<LockCtl path={f.path} /></div>
                    ) : full ? (
                      <div className="flex items-start gap-2"><div className="flex-1">{control(f)}</div><LockCtl path={f.path} /></div>
                    ) : control(f)}
                    {f.path === "content.description" && (
                      <p className="text-[11px] text-muted-foreground">Variables: {MERGE_TOKENS.map((t) => <code key={t.token} className="mx-0.5 rounded bg-muted px-1">{t.token}</code>)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Repeater({ kind, items, disabled, onChange }: { kind: "products" | "testimonials" | "quiz"; items: any[]; disabled: boolean; onChange: (v: any[]) => void }) {
  const sub = REPEATER_ITEMS[kind];
  const max = REPEATER_MAX[REPEATER_KEY[kind]];
  const upd = (i: number, key: string, v: string) => onChange(items.map((it, j) => (j === i ? { ...it, [key]: v } : it)));
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= items.length) return; const next = [...items]; [next[i], next[j]] = [next[j], next[i]]; onChange(next); };
  const add = () => onChange([...items, Object.fromEntries(sub.map((s) => [s.key, ""]))]);
  const del = (i: number) => onChange(items.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-hairline p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">#{i + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={disabled} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-muted disabled:opacity-40"><ChevronUp className="size-3.5" /></button>
              <button type="button" disabled={disabled} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-muted disabled:opacity-40"><ChevronDown className="size-3.5" /></button>
              <button type="button" disabled={disabled || items.length <= 1} onClick={() => del(i)} className="rounded p-1 text-danger hover:bg-danger-soft disabled:opacity-40"><Trash2 className="size-3.5" /></button>
            </div>
          </div>
          <div className="space-y-2">
            {sub.map((sf) => (
              <div key={sf.key} className="space-y-1">
                <Label className="text-[11px]">{sf.label}</Label>
                {sf.img
                  ? <ImageUpload value={it[sf.key] ?? ""} disabled={disabled} compact onChange={(url) => upd(i, sf.key, url)} />
                  : sf.ta
                  ? <Textarea value={it[sf.key] ?? ""} disabled={disabled} onChange={(e) => upd(i, sf.key, e.target.value)} rows={2} />
                  : <Input value={it[sf.key] ?? ""} disabled={disabled} onChange={(e) => upd(i, sf.key, e.target.value)} className="h-8" />}
              </div>
            ))}
          </div>
        </div>
      ))}
      {items.length < max && !disabled && (
        <button type="button" onClick={add} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary">
          <Plus className="size-3.5" /> Add {kind === "quiz" ? "answer" : kind === "products" ? "product" : "testimonial"}
        </button>
      )}
    </div>
  );
}
