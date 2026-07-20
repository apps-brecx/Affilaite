"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { runSocialScan } from "@/app/actions/admin";

export function ScanNowButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const run = () =>
    start(async () => {
      const res = await runSocialScan();
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {pending ? "Scanning…" : "Scan now"}
    </Button>
  );
}
