"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { payNowAll } from "@/app/actions/admin";

/** Runs a payout batch right now for every affiliate over their minimum. */
export function PayNowButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await payNowAll();
          toast(res.message, res.ok ? "success" : "error");
          if (res.ok) router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Pay now
    </Button>
  );
}
