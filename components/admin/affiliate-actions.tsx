"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Ban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { setAffiliateStatus, assignProgram } from "@/app/actions/admin";
import type { AffiliateState } from "@/lib/types";

export function AffiliateActions({ id, name, status }: { id: string; name?: string; status: AffiliateState }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<AffiliateState | null>(null);
  const router = useRouter();
  const toast = useToast();
  const who = name ?? "this affiliate";

  const act = (next: AffiliateState) =>
    start(async () => {
      const res = await setAffiliateStatus(id, next);
      toast(res.message, res.ok ? "success" : "error");
      setConfirm(null);
      router.refresh();
    });

  return (
    <div className="flex gap-2">
      {status === "approved" ? (
        <Button variant="outline" onClick={() => setConfirm("suspended")} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />} Suspend
        </Button>
      ) : (
        <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setConfirm("approved")} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
        </Button>
      )}

      <ConfirmDialog
        open={confirm === "suspended"}
        onClose={() => !pending && setConfirm(null)}
        onConfirm={() => act("suspended")}
        pending={pending}
        variant="danger"
        title="Suspend affiliate?"
        description={`${who} will lose portal access and stop earning commissions until reinstated.`}
        confirmLabel="Suspend"
      />
      <ConfirmDialog
        open={confirm === "approved"}
        onClose={() => !pending && setConfirm(null)}
        onConfirm={() => act("approved")}
        pending={pending}
        variant="success"
        title="Approve affiliate?"
        description={`${who} will be approved and gain access to the partner portal.`}
        confirmLabel="Approve"
      />
    </div>
  );
}

export function ReassignProgram({
  id,
  programId,
  programs,
}: {
  id: string;
  programId: string;
  programs: { id: string; name: string }[];
}) {
  const [value, setValue] = useState(programId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const save = (next: string) => {
    setValue(next);
    start(async () => {
      const res = await assignProgram(id, next);
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={pending}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle"
      >
        {programs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
    </div>
  );
}
