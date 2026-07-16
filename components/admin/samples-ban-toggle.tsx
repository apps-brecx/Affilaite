"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setSamplesBanned } from "@/app/actions/admin";

export function SamplesBanToggle({ affiliateId, banned }: { affiliateId: string; banned: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const flip = () =>
    start(async () => {
      const res = await setSamplesBanned(affiliateId, !banned);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
  return (
    <Button variant={banned ? "outline" : "ghost"} size="sm" onClick={flip} disabled={pending} className={banned ? "" : "text-danger hover:text-danger"}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : banned ? <Undo2 className="size-4" /> : <Ban className="size-4" />}
      {banned ? "Allow samples" : "Ban from samples"}
    </Button>
  );
}
