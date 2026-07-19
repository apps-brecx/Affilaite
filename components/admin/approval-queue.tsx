"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setAffiliateStatus } from "@/app/actions/admin";
import { relativeTime } from "@/lib/utils";
import type { Affiliate } from "@/lib/types";

/** A quick 0–100 quality signal to help triage applicants at a glance. */
function scoreApplicant(a: Affiliate): { score: number; tone: "high" | "mid" | "low" } {
  let s = 40;
  const size = (a.audienceSize ?? "").toLowerCase();
  if (/1m|500k|100k\+|over/.test(size)) s += 35;
  else if (/50k|100k/.test(size)) s += 25;
  else if (/10k|25k/.test(size)) s += 15;
  if (a.channel) s += 5;
  const links = Object.values(a.socialLinks ?? {}).filter(Boolean).length;
  s += Math.min(15, links * 5);
  if (a.companyName) s += 5;
  s = Math.min(100, s);
  return { score: s, tone: s >= 70 ? "high" : s >= 50 ? "mid" : "low" };
}

export function ApprovalQueue({ pending: queue }: { pending: Affiliate[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const act = (id: string, status: "approved" | "rejected") => {
    setBusy(id);
    start(async () => {
      const res = await setAffiliateStatus(id, status);
      toast(res.message, res.ok ? "success" : "error");
      setBusy(null);
      router.refresh();
    });
  };

  if (queue.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">All caught up — no pending applications.</p>;
  }

  return (
    <div className="space-y-3">
      {queue.map((a) => (
        <div key={a.id} className="flex items-center gap-3 rounded-lg border border-hairline p-3">
          <Avatar name={a.name} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{a.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[a.channel, a.audienceSize].filter(Boolean).join(" · ") || a.companyName || a.email} · {relativeTime(a.joinedAt)}
            </p>
          </div>
          {(() => {
            const { score, tone } = scoreApplicant(a);
            const cls = tone === "high" ? "bg-success-soft text-success" : tone === "mid" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground";
            return <span title="Applicant quality score" className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>{score}</span>;
          })()}
          <div className="flex gap-1.5">
            {busy === a.id ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <>
                <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => act(a.id, "rejected")}>
                  <X className="size-4" />
                </Button>
                <Button size="icon-sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => act(a.id, "approved")}>
                  <Check className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
      <Button variant="outline" className="w-full" asChild>
        <Link href="/admin/affiliates">Manage all affiliates</Link>
      </Button>
    </div>
  );
}
