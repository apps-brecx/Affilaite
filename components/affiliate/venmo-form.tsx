"use client";

import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PhoneVerify } from "@/components/marketing/phone-verify";
import { updatePayoutPhone } from "@/app/actions/affiliate";

export function VenmoForm({ defaultPhone, verified }: { defaultPhone: string; verified: boolean }) {
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = () =>
    start(async () => {
      if (!verifiedPhone) return;
      const res = await updatePayoutPhone(verifiedPhone);
      toast(res.message, res.ok ? "success" : "error");
    });

  return (
    <div className="space-y-3">
      {defaultPhone && (
        <p className="text-xs text-muted-foreground">
          Current: <span className="font-medium text-foreground">{defaultPhone}</span>
          {verified ? " · verified" : " · unverified"}
        </p>
      )}
      <PhoneVerify onVerified={setVerifiedPhone} initialPhone={defaultPhone} label="Venmo mobile number" />
      <Button onClick={save} disabled={pending || !verifiedPhone} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save Venmo number
      </Button>
    </div>
  );
}
