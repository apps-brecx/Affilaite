"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, RotateCcw, Send, Save, Mail, MailX, Clock, Lightbulb, Plus, Trash2, Users, Sparkles } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  saveEmailTemplate,
  toggleEmailTemplate,
  resetEmailTemplate,
  sendTestEmail,
  previewEmail,
  saveCustomEmail,
  deleteCustomEmail,
  sendTestCustomEmail,
  sendCustomEmailToAudience,
} from "@/app/actions/email-center";
import type { EmailType, EmailTemplate, EmailCategory, CustomEmail } from "@/lib/email-center";

type Item = { type: EmailType; tpl: EmailTemplate };

const CATEGORY_ORDER: EmailCategory[] = ["Onboarding", "Sales", "Payouts", "Security"];
const CUSTOM_VARS = [
  { token: "{{name}}", label: "Partner's name" },
  { token: "{{code}}", label: "Their discount code" },
  { token: "{{earnings}}", label: "Total earned" },
  { token: "{{link}}", label: "Their referral link" },
];

const blankCustom = (): CustomEmail => ({ id: "", name: "Untitled email", subject: "", body: "", ctaText: "", ctaUrl: "", imageUrl: "", buttonColor: "" });

export function EmailCenter({ items, customs: initialCustoms, adminEmail }: { items: Item[]; customs: CustomEmail[]; adminEmail: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();

  const [drafts, setDrafts] = useState<Record<string, EmailTemplate>>(() =>
    Object.fromEntries(items.map((i) => [i.type.key, { ...i.tpl }])),
  );
  const [customs, setCustoms] = useState<CustomEmail[]>(initialCustoms);
  const [customDrafts, setCustomDrafts] = useState<Record<string, CustomEmail>>(() =>
    Object.fromEntries(initialCustoms.map((c) => [c.id, { ...c }])),
  );
  const [selected, setSelected] = useState(items[0]?.type.key ?? "");
  const [testTo, setTestTo] = useState(adminEmail);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const isCustom = selected.startsWith("c:");
  const customId = isCustom ? selected.slice(2) : "";
  const current = items.find((i) => i.type.key === selected);
  const draft = isCustom ? customDrafts[customId] : drafts[selected];

  const grouped = useMemo(() => {
    const m = new Map<EmailCategory, Item[]>();
    for (const c of CATEGORY_ORDER) m.set(c, []);
    for (const i of items) m.get(i.type.category)?.push(i);
    return [...m.entries()].filter(([, list]) => list.length);
  }, [items]);

  const patch = (p: Partial<EmailTemplate & CustomEmail>) => {
    if (isCustom) setCustomDrafts((d) => ({ ...d, [customId]: { ...d[customId], ...p } as CustomEmail }));
    else setDrafts((d) => ({ ...d, [selected]: { ...d[selected], ...p } }));
  };

  // Debounced live preview.
  useEffect(() => {
    if (!draft) return;
    setPreviewing(true);
    const t = setTimeout(async () => {
      const r = await previewEmail(selected, {
        subject: (draft as any).subject ?? "",
        body: (draft as any).body ?? "",
        ctaText: (draft as any).ctaText ?? "",
        ctaUrl: (draft as any).ctaUrl ?? "",
        imageUrl: (draft as any).imageUrl ?? "",
        buttonColor: (draft as any).buttonColor ?? "",
      });
      setPreview(r);
      setPreviewing(false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, (draft as any)?.subject, (draft as any)?.body, (draft as any)?.ctaText, (draft as any)?.ctaUrl, (draft as any)?.imageUrl, (draft as any)?.buttonColor]);

  const insertVar = (token: string) => {
    const el = bodyRef.current;
    const body = (draft as any).body ?? "";
    if (!el) return patch({ body: body + token });
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    patch({ body: body.slice(0, s) + token + body.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + token.length;
    });
  };

  // ---- built-in actions ----
  const save = () =>
    start(async () => {
      if (isCustom) {
        const res = await saveCustomEmail(customDrafts[customId]);
        toast(res.message, res.ok ? "success" : "error");
      } else {
        const res = await saveEmailTemplate({ key: selected, ...drafts[selected] });
        toast(res.message, res.ok ? "success" : "error");
      }
    });

  const reset = () =>
    start(async () => {
      const res = await resetEmailTemplate(selected);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok && current) {
        patch({
          enabled: true,
          subject: current.type.defaultSubject,
          body: current.type.defaultBody,
          ctaText: current.type.defaultCtaText,
          ctaUrl: current.type.defaultCtaUrl,
          imageUrl: "",
          buttonColor: "",
        });
      }
    });

  const test = () =>
    start(async () => {
      const res = isCustom ? await sendTestCustomEmail(customId, testTo) : await sendTestEmail(selected, testTo);
      toast(res.message, res.ok ? "success" : "error");
    });

  const toggle = (key: string, enabled: boolean) => {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], enabled } }));
    start(async () => {
      const res = await toggleEmailTemplate(key, enabled);
      if (!res.ok) {
        setDrafts((d) => ({ ...d, [key]: { ...d[key], enabled: !enabled } }));
        toast(res.message, "error");
      } else toast(enabled ? "Email turned on." : "Email turned off.", "success");
    });
  };

  // ---- custom actions ----
  const createCustom = () =>
    start(async () => {
      const res = await saveCustomEmail({ ...blankCustom() });
      if (res.ok && res.id) {
        const fresh = { ...blankCustom(), id: res.id };
        setCustoms((c) => [fresh, ...c]);
        setCustomDrafts((d) => ({ ...d, [res.id!]: fresh }));
        setSelected(`c:${res.id}`);
        toast("New custom email created.", "success");
      } else toast(res.message, "error");
    });

  const removeCustom = () =>
    start(async () => {
      if (!confirm("Delete this custom email?")) return;
      const res = await deleteCustomEmail(customId);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setCustoms((c) => c.filter((x) => x.id !== customId));
        setSelected(items[0]?.type.key ?? "");
      }
    });

  const sendToAudience = (audience: "approved" | "all") =>
    start(async () => {
      const label = audience === "all" ? "everyone (approved, applicants & suspended)" : "all approved partners";
      if (!confirm(`Send "${(draft as any).name}" to ${label}? This sends real email.`)) return;
      const res = await sendCustomEmailToAudience(customId, audience);
      toast(res.message, res.ok ? "success" : "error");
    });

  if (!draft) return null;
  const variables = isCustom ? CUSTOM_VARS : current?.type.variables ?? [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      {/* List */}
      <aside className="space-y-6">
        {grouped.map(([category, list]) => (
          <div key={category}>
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
            <div className="space-y-1.5">
              {list.map(({ type }) => {
                const on = drafts[type.key]?.enabled;
                const active = type.key === selected;
                return (
                  <div key={type.key} className={`rounded-xl border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "border-hairline bg-card hover:border-primary/30"}`}>
                    <button type="button" onClick={() => setSelected(type.key)} className="flex w-full items-start gap-2 text-left">
                      <span className={`mt-0.5 shrink-0 ${on ? "text-primary" : "text-muted-foreground"}`}>
                        {on ? <Mail className="size-4" /> : <MailX className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{type.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{type.description}</span>
                      </span>
                    </button>
                    <div className="mt-2 flex items-center justify-between pl-6">
                      {type.togglable ? <Switch checked={on} onCheckedChange={(v) => toggle(type.key, v)} /> : <Badge variant="secondary">Always on</Badge>}
                      {!on && type.togglable && <span className="text-[11px] text-muted-foreground">Off</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Custom emails */}
        <div>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom</p>
            <button type="button" onClick={createCustom} disabled={pending} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              <Plus className="size-3.5" /> New
            </button>
          </div>
          <div className="space-y-1.5">
            {customs.length === 0 && <p className="px-1 text-xs text-muted-foreground">Build a one-off email from scratch and send it to a segment.</p>}
            {customs.map((c) => {
              const active = selected === `c:${c.id}`;
              const name = customDrafts[c.id]?.name ?? c.name;
              return (
                <button key={c.id} type="button" onClick={() => setSelected(`c:${c.id}`)} className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-hairline bg-card hover:border-primary/30"}`}>
                  <Sparkles className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name || "Untitled email"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* Editor + preview */}
      <section className="space-y-5">
        <div className="rounded-xl border border-hairline bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{isCustom ? (draft as CustomEmail).name || "Custom email" : current?.type.label}</h2>
            {isCustom ? (
              <Badge variant="secondary">Custom</Badge>
            ) : current?.type.togglable ? (
              <Badge variant={(draft as EmailTemplate).enabled ? "success" : "secondary"}>{(draft as EmailTemplate).enabled ? "On" : "Off"}</Badge>
            ) : (
              <Badge variant="secondary">Always on</Badge>
            )}
          </div>

          {!isCustom && current && (
            <div className="mb-4 space-y-2 rounded-lg bg-muted/60 p-3 text-xs">
              <p className="flex items-start gap-2 text-muted-foreground">
                <Clock className="mt-0.5 size-3.5 shrink-0" /> <span><span className="font-medium text-foreground">When it sends:</span> {current.type.whenText}</span>
              </p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-gold" /> <span><span className="font-medium text-foreground">Tip:</span> {current.type.recommendation}</span>
              </p>
            </div>
          )}

          <div className="space-y-4">
            {isCustom && (
              <div className="space-y-1.5">
                <Label>Name (internal)</Label>
                <Input value={(draft as CustomEmail).name} onChange={(e) => patch({ name: e.target.value })} maxLength={80} placeholder="Spring sale announcement" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Subject line</Label>
              <Input value={(draft as any).subject} onChange={(e) => patch({ subject: e.target.value })} maxLength={200} />
            </div>

            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea ref={bodyRef} value={(draft as any).body} onChange={(e) => patch({ body: e.target.value })} rows={7} maxLength={4000} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">Insert:</span>
                {variables.map((v) => (
                  <button key={v.token} type="button" onClick={() => insertVar(v.token)} title={v.label} className="inline-flex items-center gap-1 rounded-full border border-hairline bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                    <Plus className="size-3" /> {v.token}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Button text (optional)</Label>
                <Input value={(draft as any).ctaText} onChange={(e) => patch({ ctaText: e.target.value })} maxLength={60} placeholder="Shop now" />
              </div>
              <div className="space-y-1.5">
                <Label>Button link</Label>
                <Input value={(draft as any).ctaUrl} onChange={(e) => patch({ ctaUrl: e.target.value })} maxLength={500} placeholder="https://… or {{link}}" />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Header image URL (optional)</Label>
                <Input value={(draft as any).imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} maxLength={1000} placeholder="https://cdn.yourstore.com/banner.png" />
              </div>
              <div className="space-y-1.5">
                <Label>Button colour (optional)</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test((draft as any).buttonColor) ? (draft as any).buttonColor : "#FF5C9E"} onChange={(e) => patch({ buttonColor: e.target.value })} className="size-10 shrink-0 cursor-pointer rounded-md border border-hairline bg-background p-0.5" aria-label="Button colour" />
                  <Input value={(draft as any).buttonColor} onChange={(e) => patch({ buttonColor: e.target.value })} placeholder="Uses brand colour" className="font-mono" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </Button>
            {!isCustom ? (
              <Button variant="outline" onClick={reset} disabled={pending}>
                <RotateCcw className="size-4" /> Reset to default
              </Button>
            ) : (
              <Button variant="danger" onClick={removeCustom} disabled={pending}>
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} className="h-9 w-52" placeholder="you@email.com" aria-label="Send test to" />
              <Button variant="secondary" onClick={test} disabled={pending}>
                <Send className="size-4" /> Send test
              </Button>
            </div>
          </div>

          {isCustom && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 p-3">
              <span className="flex items-center gap-1.5 text-sm font-medium"><Users className="size-4 text-primary" /> Send this email:</span>
              <Button size="sm" variant="gold" onClick={() => sendToAudience("approved")} disabled={pending}>To all approved</Button>
              <Button size="sm" variant="outline" onClick={() => sendToAudience("all")} disabled={pending}>To everyone</Button>
              <span className="text-[11px] text-muted-foreground">Save your edits first · respects the “Program updates” opt-out.</span>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-hairline bg-card">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="text-sm font-medium">Preview</p>
            {previewing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <div className="p-4">
            <p className="mb-3 text-sm">
              <span className="text-muted-foreground">Subject: </span>
              <span className="font-medium">{preview?.subject || (draft as any).subject}</span>
            </p>
            <iframe title="Email preview" sandbox="" className="h-[460px] w-full rounded-lg border border-hairline bg-white" srcDoc={preview?.html ?? ""} />
          </div>
        </div>
      </section>
    </div>
  );
}
