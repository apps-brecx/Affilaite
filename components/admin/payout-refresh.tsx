"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { reconcilePayout } from "@/app/actions/admin";

/** Poll PayPal for this batch's latest status on demand. */
export function PayoutRefresh({ payoutId }: { payoutId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const refresh = () =>
    start(async () => {
      const res = await reconcilePayout(payoutId);
      toast(res.ok ? `Status: ${res.status}` : res.message ?? "Couldn't refresh.", res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Button variant="outline" size="sm" onClick={refresh} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh from PayPal
    </Button>
  );
}
