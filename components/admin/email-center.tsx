"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Loader2, RotateCcw, Send, Save, Mail, MailX, Clock, Lightbulb, Plus } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveEmailTemplate, toggleEmailTemplate, resetEmailTemplate, sendTestEmail, previewEmail } from "@/app/actions/email-center";
import type { EmailType, EmailTemplate, EmailCategory } from "@/lib/email-center";

type Item = { type: EmailType; tpl: EmailTemplate };

const CATEGORY_ORDER: EmailCategory[] = ["Onboarding", "Sales", "Payouts", "Security"];

export function EmailCenter({ items, adminEmail }: { items: Item[]; adminEmail: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();

  // Local draft + enabled state, keyed by email type.
  const [drafts, setDrafts] = useState<Record<string, EmailTemplate>>(() =>
    Object.fromEntries(items.map((i) => [i.type.key, { ...i.tpl }])),
  );
  const [selected, setSelected] = useState(items[0]?.type.key ?? "");
  const [testTo, setTestTo] = useState(adminEmail);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const current = items.find((i) => i.type.key === selected);
  const draft = drafts[selected];

  const grouped = useMemo(() => {
    const m = new Map<EmailCategory, Item[]>();
    for (const c of CATEGORY_ORDER) m.set(c, []);
    for (const i of items) m.get(i.type.category)?.push(i);
    return [...m.entries()].filter(([, list]) => list.length);
  }, [items]);

  const patch = (p: Partial<EmailTemplate>) => setDrafts((d) => ({ ...d, [selected]: { ...d[selected], ...p } }));

  // Debounced live preview whenever the selected draft changes.
  useEffect(() => {
    if (!current || !draft) return;
    setPreviewing(true);
    const t = setTimeout(async () => {
      const r = await previewEmail(selected, {
        subject: draft.subject,
        body: draft.body,
        ctaText: draft.ctaText,
        ctaUrl: draft.ctaUrl,
        imageUrl: draft.imageUrl,
      });
      setPreview(r);
      setPreviewing(false);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, draft?.subject, draft?.body, draft?.ctaText, draft?.ctaUrl, draft?.imageUrl]);

  const insertVar = (token: string) => {
    const el = bodyRef.current;
    if (!el) return patch({ body: (draft.body ?? "") + token });
    const s = el.selectionStart ?? draft.body.length;
    const e = el.selectionEnd ?? draft.body.length;
    patch({ body: draft.body.slice(0, s) + token + draft.body.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + token.length;
    });
  };

  const save = () =>
    start(async () => {
      const res = await saveEmailTemplate({ key: selected, ...draft });
      toast(res.message, res.ok ? "success" : "error");
    });

  const reset = () =>
    start(async () => {
      const res = await resetEmailTemplate(selected);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok && current) {
        // Restore the code defaults into the draft.
        patch({
          enabled: true,
          subject: current.type.defaultSubject,
          body: current.type.defaultBody,
          ctaText: current.type.defaultCtaText,
          ctaUrl: current.type.defaultCtaUrl,
          imageUrl: "",
        });
      }
    });

  const test = () =>
    start(async () => {
      const res = await sendTestEmail(selected, testTo);
      toast(res.message, res.ok ? "success" : "error");
    });

  const toggle = (key: string, enabled: boolean) => {
    setDrafts((d) => ({ ...d, [key]: { ...d[key], enabled } }));
    start(async () => {
      const res = await toggleEmailTemplate(key, enabled);
      if (!res.ok) {
        setDrafts((d) => ({ ...d, [key]: { ...d[key], enabled: !enabled } }));
        toast(res.message, "error");
      } else {
        toast(enabled ? "Email turned on." : "Email turned off.", "success");
      }
    });
  };

  if (!current || !draft) return null;

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
                  <div
                    key={type.key}
                    className={`rounded-xl border p-3 transition-colors ${active ? "border-primary bg-primary/5" : "border-hairline bg-card hover:border-primary/30"}`}
                  >
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
                      {type.togglable ? (
                        <Switch checked={on} onCheckedChange={(v) => toggle(type.key, v)} />
                      ) : (
                        <Badge variant="secondary">Always on</Badge>
                      )}
                      {!on && type.togglable && <span className="text-[11px] text-muted-foreground">Off</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </aside>

      {/* Editor + preview */}
      <section className="space-y-5">
        <div className="rounded-xl border border-hairline bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg font-semibold">{current.type.label}</h2>
            {current.type.togglable ? (
              <Badge variant={draft.enabled ? "success" : "secondary"}>{draft.enabled ? "On" : "Off"}</Badge>
            ) : (
              <Badge variant="secondary">Always on</Badge>
            )}
          </div>

          <div className="mb-4 space-y-2 rounded-lg bg-muted/60 p-3 text-xs">
            <p className="flex items-start gap-2 text-muted-foreground">
              <Clock className="mt-0.5 size-3.5 shrink-0" /> <span><span className="font-medium text-foreground">When it sends:</span> {current.type.whenText}</span>
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-gold" /> <span><span className="font-medium text-foreground">Tip:</span> {current.type.recommendation}</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Subject line</Label>
              <Input value={draft.subject} onChange={(e) => patch({ subject: e.target.value })} maxLength={200} />
            </div>

            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea ref={bodyRef} value={draft.body} onChange={(e) => patch({ body: e.target.value })} rows={7} maxLength={4000} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground">Insert:</span>
                {current.type.variables.map((v) => (
                  <button
                    key={v.token}
                    type="button"
                    onClick={() => insertVar(v.token)}
                    title={v.label}
                    className="inline-flex items-center gap-1 rounded-full border border-hairline bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    <Plus className="size-3" /> {v.token}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Button text (optional)</Label>
                <Input value={draft.ctaText} onChange={(e) => patch({ ctaText: e.target.value })} maxLength={60} placeholder="Sign in & start earning" />
              </div>
              <div className="space-y-1.5">
                <Label>Button link</Label>
                <Input value={draft.ctaUrl} onChange={(e) => patch({ ctaUrl: e.target.value })} maxLength={500} placeholder="{{loginUrl}} or https://…" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Header image URL (optional)</Label>
              <Input value={draft.imageUrl} onChange={(e) => patch({ imageUrl: e.target.value })} maxLength={1000} placeholder="https://cdn.yourstore.com/banner.png" />
              <p className="text-[11px] text-muted-foreground">Paste a hosted image link (your Shopify CDN works great). It shows at the top of the email.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
            </Button>
            <Button variant="outline" onClick={reset} disabled={pending}>
              <RotateCcw className="size-4" /> Reset to default
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} className="h-9 w-52" placeholder="you@email.com" aria-label="Send test to" />
              <Button variant="secondary" onClick={test} disabled={pending}>
                <Send className="size-4" /> Send test
              </Button>
            </div>
          </div>
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
              <span className="font-medium">{preview?.subject || draft.subject}</span>
            </p>
            <iframe
              title="Email preview"
              sandbox=""
              className="h-[460px] w-full rounded-lg border border-hairline bg-white"
              srcDoc={preview?.html ?? ""}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
