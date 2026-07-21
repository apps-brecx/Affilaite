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

type Row = { name?: string; email: string; code?: string };
const isEmail = (s?: string) => !!s && /.+@.+\..+/.test(s);

// Parse pasted text or CSV into {name,email,code} rows. Header-aware so a
// ReferralCandy export (name,email,coupon/code) keeps each affiliate's code.
function parseRows(text: string): Row[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  let cols: string[] | null = null;
  if (lines[0].toLowerCase().includes("email")) {
    cols = lines[0].split(/[,;\t]/).map((s) => s.trim().toLowerCase());
    lines.shift();
  }

  const out: Row[] = [];
  for (const line of lines) {
    const parts = line.split(/[,;\t]/).map((s) => s.trim());
    let name: string | undefined, email: string | undefined, code: string | undefined;
    if (cols) {
      const at = (n: string) => {
        const i = cols!.indexOf(n);
        return i >= 0 ? parts[i] : undefined;
      };
      name = at("name") || at("full name");
      email = at("email") || at("email address");
      code = at("code") || at("coupon") || at("coupon code") || at("discount code");
    } else {
      email = parts.find((p) => isEmail(p));
      const rest = parts.filter((p) => p !== email && p.length > 0);
      name = rest[0];
      code = rest[1];
    }
    if (!isEmail(email)) continue;
    out.push({ name: name || undefined, email: email!, code: code || undefined });
  }
  return out;
}

export function AffiliatesToolbar({
  affiliates,
  templates,
  campaigns = [],
}: {
  affiliates: Affiliate[];
  templates: InviteTemplate[];
  campaigns?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("single");
  const [templateId, setTemplateId] = useState(templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? "");
  const [campaignId, setCampaignId] = useState("");
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
    const blob = new Blob(
      ["name,email,code\nJane Doe,jane@example.com,JANE20\nJohn Smith,john@example.com,JOHN20\n"],
      { type: "text/csv" },
    );
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
        code: String(fd.get("code") ?? "") || undefined,
        phone: String(fd.get("phone") ?? "") || undefined,
        address: String(fd.get("address") ?? "") || undefined,
        templateId: templateId || undefined,
        campaignId: campaignId || undefined,
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
      const res = await bulkInviteAffiliates(parsed, templateId || undefined, campaignId || undefined);
      toast(res.message, res.ok ? "success" : "error");
      if (res.created > 0) {
        setOpen(false);
        setBulkText("");
        router.refresh();
      }
    });
  };

  const CampaignSelect = () => (
    <div className="space-y-1.5">
      <Label>Add to campaign <span className="text-muted-foreground">(optional)</span></Label>
      {campaigns.length === 0 ? (
        <p className="rounded-md border border-hairline bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          No campaigns yet — create one in <strong>Campaigns</strong> to invite partners straight into it.
        </p>
      ) : (
        <>
          <select
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle"
          >
            <option value="">No campaign — general invite</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Enrolls them in this campaign and issues that campaign&apos;s discount code.</p>
        </>
      )}
    </div>
  );

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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Mobile number <span className="text-muted-foreground">(optional)</span></Label>
                <Input name="phone" type="tel" placeholder="+1 555 123 4567" />
              </div>
              <div className="space-y-1.5">
                <Label>Existing code <span className="text-muted-foreground">(optional)</span></Label>
                <Input name="code" placeholder="Keep their current code, e.g. JANE20" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Shipping address for samples <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea name="address" rows={2} placeholder="Street, city, state, ZIP, country" />
            </div>
            <CampaignSelect />
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
            <CampaignSelect />
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
                <FileText className="size-4 text-muted-foreground" /> CSV columns{" "}
                <code className="font-mono text-xs">name,email,code</code>
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" /> Template
              </Button>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Migrating from ReferralCandy? Include each affiliate's existing <strong>code</strong> so their
              live links keep working. They'll be imported as approved and emailed a portal invite.
            </p>
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
            <CampaignSelect />
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
