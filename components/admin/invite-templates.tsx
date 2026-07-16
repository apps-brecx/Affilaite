"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Star, Trash2, Loader2, Pencil, X, Braces } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  createInviteTemplate,
  updateInviteTemplate,
  deleteInviteTemplate,
  setDefaultInviteTemplate,
} from "@/app/actions/admin";
import type { InviteTemplate } from "@/lib/queries";

const VARS = ["{{name}}", "{{code}}", "{{loginUrl}}", "{{tempPassword}}", "{{link}}"];

function TemplateForm({
  initial,
  onDone,
}: {
  initial?: InviteTemplate;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  const [body, setBody] = useState(
    initial?.body ??
      "Hi {{name}},\n\nYou've been invited to the Syruvia partner program! Your personal discount code is {{code}}.\n\nSign in here: {{loginUrl}}\nTemporary password: {{tempPassword}}\n\nWelcome aboard — happy sharing!",
  );
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = { name: String(fd.get("name") ?? ""), subject: String(fd.get("subject") ?? ""), body };
    start(async () => {
      const res = initial ? await updateInviteTemplate(initial.id, payload) : await createInviteTemplate(payload);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Template name</Label>
          <Input name="name" required defaultValue={initial?.name} placeholder="Warm welcome" />
        </div>
        <div className="space-y-1.5">
          <Label>Email subject</Label>
          <Input name="subject" required defaultValue={initial?.subject} placeholder="You're invited to Syruvia 🎉" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email body</Label>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} required />
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Braces className="size-3" /> Insert:</span>
          {VARS.map((v) => (
            <button type="button" key={v} onClick={() => setBody((b) => `${b}${v}`)} className="kbd hover:bg-accent">
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} {initial ? "Save template" : "Create template"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

export function InviteTemplates({ templates }: { templates: InviteTemplate[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const act = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-primary" /> Invite templates
        </CardTitle>
        {!creating && !editingId && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New template
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Design the email new partners receive. Pick a template each time you invite. Variables like{" "}
          <code className="rounded bg-muted px-1 font-mono text-xs">{"{{code}}"}</code> are filled in automatically.
        </p>

        {creating && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
            <TemplateForm onDone={() => setCreating(false)} />
          </div>
        )}

        {templates.length === 0 && !creating && (
          <p className="rounded-lg border border-dashed border-hairline py-8 text-center text-sm text-muted-foreground">
            No invite templates yet. Create one to personalize your invitations.
          </p>
        )}

        {templates.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
              <TemplateForm initial={t} onDone={() => setEditingId(null)} />
            </div>
          ) : (
            <div key={t.id} className="rounded-lg border border-hairline p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{t.name}</p>
                    {t.isDefault && <Badge variant="default" className="gap-1"><Star className="size-3" /> Default</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{t.subject}</p>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{t.body}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!t.isDefault && (
                    <Button size="icon-sm" variant="ghost" title="Set default" onClick={() => act(() => setDefaultInviteTemplate(t.id))} disabled={pending}>
                      <Star className="size-4" />
                    </Button>
                  )}
                  <Button size="icon-sm" variant="ghost" title="Edit" onClick={() => setEditingId(t.id)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft" title="Delete" onClick={() => act(() => deleteInviteTemplate(t.id))} disabled={pending}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ),
        )}
      </CardContent>
    </Card>
  );
}
