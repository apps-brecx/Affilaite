"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setCampaignStatus } from "@/app/actions/admin";
import type { CampaignStatus } from "@/lib/types";

export function CampaignStatusToggle({ id, status }: { id: string; status: CampaignStatus }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const active = status === "active";

  const toggle = () =>
    start(async () => {
      const res = await setCampaignStatus(id, active ? "paused" : "active");
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });

  return (
    <Button variant={active ? "outline" : "default"} onClick={toggle} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : active ? <Pause className="size-4" /> : <Play className="size-4" />}
      {active ? "Pause campaign" : "Activate campaign"}
    </Button>
  );
}
