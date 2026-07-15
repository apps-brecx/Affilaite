"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Sparkles,
  Loader2,
  ShoppingBag,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  Check,
  X,
  CloudOff,
  Cloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  bulkCreateDiscounts,
  createSingleDiscount,
  updateDiscountCode,
  toggleDiscountCode,
  deleteDiscountCode,
} from "@/app/actions/admin";
import type { DiscountCodeRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface Target {
  id: string;
  name: string;
  refCode: string;
}

export function DiscountManager({
  codes,
  targets,
  shopifyConnected,
}: {
  codes: DiscountCodeRow[];
  targets: Target[];
  shopifyConnected: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();

  // search / filter
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      codes.filter(
        (c) =>
          !q ||
          c.code.toLowerCase().includes(q.toLowerCase()) ||
          (c.affiliateName ?? "").toLowerCase().includes(q.toLowerCase()),
      ),
    [codes, q],
  );

  // modals
  const [bulkOpen, setBulkOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCodeRow | null>(null);
  const [deleting, setDeleting] = useState<DiscountCodeRow | null>(null);

  const refresh = () => router.refresh();

  const toggle = (c: DiscountCodeRow) =>
    start(async () => {
      const res = await toggleDiscountCode(c.id, !c.active);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) refresh();
    });

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search codes or affiliates…" className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setBulkOpen(true)}>
            <Sparkles className="size-4" /> Bulk generate
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New code
          </Button>
        </div>
      </div>

      {!shopifyConnected && (
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-warning-soft/40 px-3 py-2 text-xs text-warning">
          <CloudOff className="size-4 shrink-0" />
          Shopify isn&apos;t connected — codes are saved here but not created in your store yet. Connect Shopify in Settings → Integrations.
        </div>
      )}

      {/* Codes table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="size-4 text-primary" /> Discount codes
          </CardTitle>
          <Badge variant="muted">{codes.length} total</Badge>
        </CardHeader>
        <CardContent className="px-0">
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {codes.length === 0 ? "No discount codes yet — create one or bulk generate." : "No codes match your search."}
            </p>
          ) : (
            <div className="divide-y divide-hairline">
              {filtered.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-lg",
                      c.active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Ticket className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-sm font-semibold">{c.code}</p>
                      <Badge variant="muted">{c.percentage}%</Badge>
                      {!c.active && <Badge variant="warning">disabled</Badge>}
                      {c.syncedToShopify ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-success">
                          <Cloud className="size-3" /> In Shopify
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CloudOff className="size-3" /> Local only
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.affiliateName ?? "Unassigned"}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => toggle(c)} disabled={pending} title={c.active ? "Deactivate" : "Activate"}>
                      <Power className={cn("size-4", c.active ? "text-success" : "text-muted-foreground")} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(c)} title="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(c)} title="Delete">
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BulkModal open={bulkOpen} onClose={() => setBulkOpen(false)} targets={targets} shopifyConnected={shopifyConnected} />
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} targets={targets} />
      <EditModal code={editing} onClose={() => setEditing(null)} />
      <DeleteModal code={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

/* ---------- Bulk generate ---------- */
function BulkModal({
  open,
  onClose,
  targets,
  shopifyConnected,
}: {
  open: boolean;
  onClose: () => void;
  targets: Target[];
  shopifyConnected: boolean;
}) {
  const [prefix, setPrefix] = useState("");
  const [percent, setPercent] = useState(15);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const example = `${prefix}${targets[0]?.refCode ?? "SARAH"}${percent}`.toUpperCase();

  const run = () =>
    start(async () => {
      const res = await bulkCreateDiscounts(percent, prefix);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });

  return (
    <Modal open={open} onClose={onClose} title="Bulk generate codes" description={`One code for each of ${targets.length} approved affiliate${targets.length === 1 ? "" : "s"}.`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Prefix (optional)</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="SUMMER" />
          </div>
          <div className="space-y-1.5">
            <Label>Discount %</Label>
            <Input type="number" value={percent} onChange={(e) => setPercent(Number(e.target.value))} min={1} max={90} />
          </div>
        </div>
        <div className="rounded-lg border border-hairline bg-muted/40 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Example code</p>
          <p className="mt-0.5 font-mono font-medium">{example}</p>
        </div>
        {!shopifyConnected && (
          <p className="rounded-md bg-warning-soft/40 px-3 py-2 text-xs text-warning">
            Shopify isn&apos;t connected — codes will be saved locally only.
          </p>
        )}
        <p className="text-xs text-muted-foreground">Existing codes are skipped. Throttled to respect Shopify&apos;s rate limits.</p>
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={pending || targets.length === 0}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />} Generate {targets.length}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Create single ---------- */
function CreateModal({ open, onClose, targets }: { open: boolean; onClose: () => void; targets: Target[] }) {
  const [affiliateId, setAffiliateId] = useState("");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("15");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const chosen = targets.find((t) => t.id === affiliateId);
  // Suggest a code the first time an affiliate is picked and the field is empty.
  const onPick = (id: string) => {
    setAffiliateId(id);
    const t = targets.find((x) => x.id === id);
    if (t && !code) setCode(`${t.refCode}${percent}`.toUpperCase());
  };

  const reset = () => {
    setAffiliateId("");
    setCode("");
    setPercent("15");
  };

  const run = () =>
    start(async () => {
      const res = await createSingleDiscount({ affiliateId, code, percentage: percent });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        onClose();
        setTimeout(reset, 200);
        router.refresh();
      }
    });

  return (
    <Modal open={open} onClose={onClose} title="New discount code" description="Create one code and assign it to an affiliate.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Affiliate</Label>
          <select
            value={affiliateId}
            onChange={(e) => onPick(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle"
          >
            <option value="">Select an affiliate…</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER15" className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>%</Label>
            <Input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} min={1} max={100} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={pending || !affiliateId || code.length < 3}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create code
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Edit ---------- */
function EditModal({ code, onClose }: { code: DiscountCodeRow | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const [percent, setPercent] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Sync local state when a new code is opened.
  const openId = code?.id ?? null;
  const [lastId, setLastId] = useState<string | null>(null);
  if (openId !== lastId) {
    setLastId(openId);
    setText(code?.code ?? "");
    setPercent(code ? String(code.percentage) : "");
  }

  const run = () =>
    start(async () => {
      if (!code) return;
      const res = await updateDiscountCode({ id: code.id, code: text, percentage: percent });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });

  return (
    <Modal open={!!code} onClose={onClose} title="Edit code" description={code?.syncedToShopify ? "Changes sync to Shopify." : "This code is local only."}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Code</Label>
            <Input value={text} onChange={(e) => setText(e.target.value.toUpperCase())} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label>%</Label>
            <Input type="number" value={percent} onChange={(e) => setPercent(e.target.value)} min={1} max={100} />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={pending || text.length < 3}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Delete ---------- */
function DeleteModal({ code, onClose }: { code: DiscountCodeRow | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const run = () =>
    start(async () => {
      if (!code) return;
      const res = await deleteDiscountCode(code.id);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        onClose();
        router.refresh();
      }
    });

  return (
    <Modal open={!!code} onClose={onClose} title="Delete code" description="This can’t be undone.">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-mono font-medium text-foreground">{code?.code}</span>
          {code?.syncedToShopify ? " and remove it from Shopify" : ""}? Any links using it will stop working.
        </p>
        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <Button variant="ghost" onClick={onClose}>
            <X className="size-4" /> Cancel
          </Button>
          <Button variant="danger" onClick={run} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
          </Button>
        </div>
      </div>
    </Modal>
  );
}
