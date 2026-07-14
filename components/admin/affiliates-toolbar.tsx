"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, UserPlus, Loader2, Upload, Users, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { inviteAffiliate, bulkInviteAffiliates } from "@/app/actions/admin";
import { formatCurrency } from "@/lib/utils";
import type { Affiliate } from "@/lib/types";
import type { InviteTemplate } from "@/lib/queries";

type Tab = "single" | "bulk" | "import";

// Parse "Name,email" / "email" lines or CSV text into {name,email} rows.
function parseRows(text: string): { name?: string; email: string }[] {
  const out: { name?: string; email: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^name\s*,\s*email/i.test(line)) continue; // header
    const parts = line.split(/[,;\t]/).map((s) => s.trim());
    const emailPart = parts.find((p) => /.+@.+\..+/.test(p));
    if (!emailPart) continue;
    const namePart = parts.find((p) => p !== emailPart && p.length > 0);
    out.push({ name: namePart, email: emailPart });
  }
  return out;
}

export function AffiliatesToolbar({
  affiliates,
  templates,
}: {
  affiliates: Affiliate[];
  templates: InviteTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("single");
  const [templateId, setTemplateId] = useState(templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? "");
  const [bulkText, setBulkText] = useState("");
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const toast = useToast();

  const parsed = useMemo(() => parseRows(bulkText), [bulkText]);

  const exportCsv = () => {
    const header = ["Name", "Email", "Code", "Status", "Program", "Group", "Clicks", "Orders", "Pending", "Approved", "Paid", "PayPal", "Joined"];
    const lines = affiliates.map((a) =>
      [a.name, a.email, a.code, a.status, a.programName, a.groupName ?? "", a.clicks, a.orders, a.pendingEarnings, a.approvedEarnings, a.paidEarnings, a.paypalEmail ?? "", a.joinedAt.slice(0, 10)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "affiliates.csv";
    el.click();
    URL.revokeObjectURL(url);
    toast(`Exported ${affiliates.length} affiliate(s).`);
  };

  const downloadTemplate = () => {
    const blob = new Blob(["name,email\nJane Doe,jane@example.com\nJohn Smith,john@example.com\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "affiliate-import-template.csv";
    el.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const submitSingle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await inviteAffiliate({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        templateId: templateId || undefined,
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  const submitBulk = () => {
    if (parsed.length === 0) {
      toast("Add at least one valid email.", "error");
      return;
    }
    start(async () => {
      const res = await bulkInviteAffiliates(parsed, templateId || undefined);
      toast(res.message, res.ok ? "success" : "error");
      if (res.created > 0) {
        setOpen(false);
        setBulkText("");
        router.refresh();
      }
    });
  };

  const TemplateSelect = () => (
    <div className="space-y-1.5">
      <Label>Invite template</Label>
      {templates.length === 0 ? (
        <p className="rounded-md border border-hairline bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          No templates yet — invites will still be created. Design one in <strong>Settings → Invite templates</strong>.
        </p>
      ) : (
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.isDefault ? "(default)" : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  return (
    <>
      <Button variant="secondary" onClick={exportCsv}>
        <Download className="size-4" /> Export
      </Button>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" /> Invite affiliate
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Invite affiliates" description="Add partners directly — they'll get a code and a login.">
        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-lg border border-hairline bg-muted/40 p-1 text-sm">
          {[
            { id: "single", label: "Single", icon: UserPlus },
            { id: "bulk", label: "Bulk paste", icon: Users },
            { id: "import", label: "CSV import", icon: Upload },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                tab === t.id ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "single" && (
          <form onSubmit={submitSingle} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input name="name" placeholder="Jane Doe" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input name="email" type="email" required placeholder="jane@email.com" />
              </div>
            </div>
            <TemplateSelect />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send invite
            </Button>
          </form>
        )}

        {tab === "bulk" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Paste emails (one per line, optional name)</Label>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                placeholder={"Jane Doe, jane@email.com\njohn@email.com\nSam Lee, sam@email.com"}
              />
              <p className="text-xs text-muted-foreground">{parsed.length} valid recipient(s) detected.</p>
            </div>
            <TemplateSelect />
            <Button className="w-full" onClick={submitBulk} disabled={pending || parsed.length === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Invite {parsed.length || ""} affiliate(s)
            </Button>
          </div>
        )}

        {tab === "import" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-hairline bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" /> CSV with columns <code className="font-mono text-xs">name,email</code>
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" /> Template
              </Button>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Choose CSV file
            </Button>
            {bulkText && (
              <div className="rounded-lg border border-hairline p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">{parsed.length} recipient(s) ready</p>
                <div className="max-h-32 space-y-0.5 overflow-y-auto">
                  {parsed.slice(0, 8).map((r, i) => (
                    <div key={i} className="truncate">{r.name ? `${r.name} · ` : ""}{r.email}</div>
                  ))}
                  {parsed.length > 8 && <div>+{parsed.length - 8} more</div>}
                </div>
              </div>
            )}
            <TemplateSelect />
            <Button className="w-full" onClick={submitBulk} disabled={pending || parsed.length === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Import &amp; invite {parsed.length || ""}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
