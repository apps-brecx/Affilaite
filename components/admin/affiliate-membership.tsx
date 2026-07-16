"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Rocket, X, Plus, Loader2, Ticket, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  assignAffiliateToCampaign,
  removeAffiliateFromCampaign,
  updateAffiliateCode,
} from "@/app/actions/admin";
import type { Campaign } from "@/lib/types";

export function AffiliateCampaigns({
  affiliateId,
  campaigns,
  memberIds,
}: {
  affiliateId: string;
  campaigns: Campaign[];
  memberIds: string[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const inSet = new Set(memberIds);
  const current = campaigns.filter((c) => inSet.has(c.id));
  const available = campaigns.filter((c) => !inSet.has(c.id));

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.message, res.ok ? "success" : "error");
      setAdding(false);
      router.refresh();
    });

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {current.length === 0 && <span className="text-sm text-muted-foreground">Not in any campaign yet.</span>}
        {current.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card py-1 pl-2.5 pr-1 text-sm"
          >
            <Rocket className="size-3.5 text-primary" />
            {c.name}
            <button
              onClick={() => run(() => removeAffiliateFromCampaign(affiliateId, c.id))}
              disabled={pending}
              className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-danger"
              aria-label="Remove"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
      </div>

      {adding ? (
        <div className="flex flex-wrap gap-1.5">
          {available.length === 0 && <span className="text-xs text-muted-foreground">In every campaign.</span>}
          {available.map((c) => (
            <button
              key={c.id}
              onClick={() => run(() => assignAffiliateToCampaign(affiliateId, c.id))}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <Plus className="size-3.5" /> {c.name}
            </button>
          ))}
          <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:text-foreground">
            Done
          </button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} disabled={campaigns.length === 0}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {campaigns.length === 0 ? "No campaigns — create one first" : "Add to campaign"}
        </Button>
      )}
    </div>
  );
}

export function EditCode({ affiliateId, code }: { affiliateId: string; code: string }) {
  const [value, setValue] = useState(code);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await updateAffiliateCode(affiliateId, value);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-1 font-mono text-sm">{code}</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <Ticket className="size-3.5" /> Edit code
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        className="h-9 w-40 font-mono"
        autoFocus
      />
      <Button size="sm" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => { setValue(code); setEditing(false); }}>
        Cancel
      </Button>
    </div>
  );
}
