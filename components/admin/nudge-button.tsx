"use client";

import { useTransition } from "react";
import { Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { nudgeAffiliate } from "@/app/actions/social";

export function NudgeButton({ affiliateId }: { affiliateId: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await nudgeAffiliate(affiliateId);
          toast(res.message, res.ok ? "success" : "error");
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />} Nudge
    </Button>
  );
}
