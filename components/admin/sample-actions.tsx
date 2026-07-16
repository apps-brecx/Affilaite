"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { decideSampleRequest } from "@/app/actions/admin";

export function SampleActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();

  const run = (a: "approve" | "reject" | "ship") => {
    setAction(a);
    start(async () => {
      const res = await decideSampleRequest(id, a);
      toast(res.message, res.ok ? "success" : "error");
      setAction(null);
      if (res.ok) router.refresh();
    });
  };

  const spin = (a: string) => pending && action === a;

  if (status === "requested") {
    return (
      <div className="flex shrink-0 gap-2">
        <Button size="sm" disabled={pending} onClick={() => run("approve")}>
          {spin("approve") ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Approve
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run("reject")}>
          {spin("reject") ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} Reject
        </Button>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <Button size="sm" variant="secondary" className="shrink-0" disabled={pending} onClick={() => run("ship")}>
        {spin("ship") ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Mark shipped
      </Button>
    );
  }

  return null;
}
