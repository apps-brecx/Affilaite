"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Search, Loader2, HandCoins, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { runCustomPayout } from "@/app/actions/admin";
import { cn } from "@/lib/utils";

interface Row {
  id: string;
  name: string;
  email: string;
  paypalEmail: string | null;
}

export function CustomPayout({ affiliates }: { affiliates: Row[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [amount, setAmount] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const filtered = useMemo(
    () => affiliates.filter((a) => !q || a.name.toLowerCase().includes(q.toLowerCase()) || a.email.toLowerCase().includes(q.toLowerCase())),
    [affiliates, q],
  );

  const close = () => {
    setOpen(false);
    setTimeout(() => {
      setSelected(null);
      setAmount("");
      setQ("");
    }, 200);
  };

  const run = () => {
    if (!selected) return;
    start(async () => {
      const res = await runCustomPayout({ affiliateId: selected.id, amount });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        close();
        router.refresh();
      }
    });
  };

  return (
    <>
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gold/10 text-gold ring-gilded">
            <HandCoins className="size-5" />
          </span>
          <div>
            <p className="font-medium">Custom payout</p>
            <p className="text-sm text-muted-foreground">Pay one affiliate an ad-hoc amount — a bonus or manual payment.</p>
          </div>
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <HandCoins className="size-4" /> Send custom payout
          </Button>
        </CardContent>
      </Card>

      <Modal open={open} onClose={close} title="Custom payout" description="Send a one-off payment to a single affiliate.">
        <div className="space-y-4">
          {!selected ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search affiliates…" className="pl-9" autoFocus />
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No affiliates found.</p>}
                {filtered.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelected(a)}
                    className="flex w-full items-center gap-3 rounded-lg border border-hairline p-2.5 text-left transition-colors hover:bg-accent"
                  >
                    <Avatar name={a.name} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.paypalEmail ?? "No PayPal email"}</p>
                    </div>
                    {!a.paypalEmail && <span className="text-[11px] text-warning">no PayPal</span>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-hairline p-3">
                <Avatar name={selected.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{selected.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{selected.paypalEmail ?? "No PayPal email on file"}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button>
              </div>

              {!selected.paypalEmail && (
                <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                  This affiliate has no PayPal email — ask them to add one before paying.
                </p>
              )}

              <div className="space-y-1.5">
                <Label>Amount (USD)</Label>
                <div className="relative w-40">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7" autoFocus />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-hairline pt-4">
                <Button variant="ghost" onClick={close}>Cancel</Button>
                <Button onClick={run} disabled={pending || !selected.paypalEmail || !amount}>
                  {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send ${amount || "0"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
