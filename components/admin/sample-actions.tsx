"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Truck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { decideSampleRequest } from "@/app/actions/admin";

export function SampleActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const [action, setAction] = useState<string | null>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const router = useRouter();
  const toast = useToast();

  const run = (a: "approve" | "reject" | "ship") => {
    setAction(a);
    start(async () => {
      const res = await decideSampleRequest(id, a, a === "ship" ? { carrier, trackingNumber, trackingUrl } : undefined);
      toast(res.message, res.ok ? "success" : "error");
      setAction(null);
      if (res.ok) {
        setShipOpen(false);
        router.refresh();
      }
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
    if (!shipOpen) {
      return (
        <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setShipOpen(true)}>
          <Truck className="size-4" /> Mark shipped
        </Button>
      );
    }
    return (
      <div className="flex w-full flex-col gap-2 sm:w-72">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Carrier (USPS…)" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-8 text-sm" />
          <Input placeholder="Tracking #" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="h-8 text-sm" />
        </div>
        <Input placeholder="Tracking URL (optional)" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="h-8 text-sm" />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" disabled={pending} onClick={() => run("ship")}>
            {spin("ship") ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} Confirm shipped
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => setShipOpen(false)}>Cancel</Button>
        </div>
      </div>
    );
  }

  return null;
}
