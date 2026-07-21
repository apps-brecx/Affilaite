"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Check, X, Ban, Loader2, Mail, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { setAffiliateStatus, sendPortalInvite, deleteAffiliate } from "@/app/actions/admin";
import { formatCurrency } from "@/lib/utils";
import type { Affiliate, AffiliateState } from "@/lib/types";

const FILTERS: { label: string; value: AffiliateState | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
];

export function AffiliatesTable({ affiliates }: { affiliates: Affiliate[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AffiliateState | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; name: string; status: AffiliateState } | null>(null);
  const [del, setDel] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();
  const toast = useToast();

  const removeAffiliate = (id: string) => {
    setBusyId(id);
    start(async () => {
      const res = await deleteAffiliate(id);
      toast(res.message, res.ok ? "success" : "error");
      setBusyId(null);
      setDel(null);
      router.refresh();
    });
  };

  const act = (id: string, status: AffiliateState) => {
    setBusyId(id);
    start(async () => {
      const res = await setAffiliateStatus(id, status);
      toast(res.message, res.ok ? "success" : "error");
      setBusyId(null);
      setConfirm(null);
      router.refresh();
    });
  };

  const CONFIRM_COPY: Record<string, { title: string; description: (n: string) => string; label: string; variant: "danger" | "success" }> = {
    approved: { title: "Approve affiliate?", description: (n) => `${n} will be approved and gain access to the partner portal.`, label: "Approve", variant: "success" },
    suspended: { title: "Suspend affiliate?", description: (n) => `${n} will lose portal access and stop earning commissions until reinstated.`, label: "Suspend", variant: "danger" },
    rejected: { title: "Reject applicant?", description: (n) => `${n}'s application will be rejected. You can approve them later if you change your mind.`, label: "Reject", variant: "danger" },
  };

  const bulkApprove = () => {
    const ids = [...selected];
    start(async () => {
      for (const id of ids) await setAffiliateStatus(id, "approved");
      toast(`${ids.length} affiliate(s) approved.`);
      setSelected(new Set());
      router.refresh();
    });
  };

  const bulkInvite = () => {
    const ids = [...selected];
    start(async () => {
      const res = await sendPortalInvite(ids);
      toast(res.message, res.ok ? "success" : "error");
      setSelected(new Set());
      router.refresh();
    });
  };

  const inviteOne = (id: string) => {
    setBusyId(id);
    start(async () => {
      const res = await sendPortalInvite([id]);
      toast(res.message, res.ok ? "success" : "error");
      setBusyId(null);
    });
  };

  const rows = useMemo(() => {
    return affiliates.filter((a) => {
      const matchesFilter = filter === "all" || a.status === filter;
      const matchesQ =
        !q ||
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.email.toLowerCase().includes(q.toLowerCase()) ||
        a.code.toLowerCase().includes(q.toLowerCase());
      return matchesFilter && matchesQ;
    });
  }, [affiliates, q, filter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, or code…"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-hairline bg-card p-1 text-sm no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors ${
                filter === f.value ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" variant="outline" onClick={bulkInvite} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Send invite
            </Button>
            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={bulkApprove} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve selected
            </Button>
          </div>
        </div>
      )}

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all affiliates"
                  checked={rows.length > 0 && rows.every((a) => selected.has(a.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((a) => a.id)) : new Set())}
                  className="size-4 rounded border-hairline accent-[hsl(var(--primary))]"
                />
              </TableHead>
              <TableHead>Affiliate</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Earned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} data-state={selected.has(a.id) ? "selected" : undefined}>
                <TableCell className="pl-4">
                  <input
                    type="checkbox"
                    aria-label={`Select ${a.name}`}
                    checked={selected.has(a.id)}
                    onChange={() => toggle(a.id)}
                    className="size-4 rounded border-hairline accent-[hsl(var(--primary))]"
                  />
                </TableCell>
                <TableCell>
                  <Link href={`/admin/affiliates/${a.id}`} className="flex items-center gap-3 group">
                    <Avatar name={a.name} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground group-hover:text-primary">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{a.programName}</TableCell>
                <TableCell>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">{a.code}</span>
                </TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{a.orders}</TableCell>
                <TableCell className="text-right tnum font-medium">{formatCurrency(a.totalEarned)}</TableCell>
                <TableCell>
                  <StatusPill status={a.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    {busyId === a.id ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {a.status === "pending" ? (
                          <>
                            <Button size="icon-sm" variant="ghost" title="Reject" aria-label="Reject" className="text-danger hover:bg-danger-soft" onClick={() => setConfirm({ id: a.id, name: a.name, status: "rejected" })}>
                              <X className="size-4" />
                            </Button>
                            <Button size="icon-sm" title="Approve" aria-label="Approve" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setConfirm({ id: a.id, name: a.name, status: "approved" })}>
                              <Check className="size-4" />
                            </Button>
                          </>
                        ) : a.status === "approved" ? (
                          <>
                            <Button size="icon-sm" variant="ghost" title="Send portal invite" aria-label="Send portal invite" className="text-muted-foreground hover:text-primary" onClick={() => inviteOne(a.id)}>
                              <Mail className="size-4" />
                            </Button>
                            <Button size="icon-sm" variant="ghost" title="Suspend" aria-label="Suspend" className="text-danger hover:bg-danger-soft" onClick={() => setConfirm({ id: a.id, name: a.name, status: "suspended" })}>
                              <Ban className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <Button size="icon-sm" variant="ghost" title="Approve" aria-label="Approve" className="text-success hover:bg-success-soft" onClick={() => setConfirm({ id: a.id, name: a.name, status: "approved" })}>
                            <Check className="size-4" />
                          </Button>
                        )}
                        {/* Remove entirely (distinct from Suspend) — available on every row. */}
                        <Button size="icon-sm" variant="ghost" title="Delete affiliate" aria-label="Delete affiliate" className="text-muted-foreground hover:bg-danger-soft hover:text-danger" onClick={() => setDel({ id: a.id, name: a.name })}>
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No affiliates match your filters.</p>
        )}
      </div>

      {confirm && (() => {
        const copy = CONFIRM_COPY[confirm.status];
        return (
          <ConfirmDialog
            open
            onClose={() => !pending && setConfirm(null)}
            onConfirm={() => act(confirm.id, confirm.status)}
            pending={pending}
            variant={copy.variant}
            title={copy.title}
            description={copy.description(confirm.name)}
            confirmLabel={copy.label}
          />
        );
      })()}

      {del && (
        <ConfirmDialog
          open
          onClose={() => !pending && setDel(null)}
          onConfirm={() => removeAffiliate(del.id)}
          pending={pending}
          variant="danger"
          title="Delete affiliate?"
          description={`${del.name} and all their data (codes, samples, messages, commissions) will be permanently removed. This can't be undone — use Suspend instead if you only want to pause them.`}
          confirmLabel="Delete"
        />
      )}
    </div>
  );
}
