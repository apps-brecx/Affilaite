"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { updatePaypalEmail } from "@/app/actions/affiliate";

export function PaypalForm({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = () => {
    start(async () => {
      const res = await updatePaypalEmail(email);
      toast(res.message, res.ok ? "success" : "error");
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pp">PayPal email</Label>
        <Input id="pp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@paypal.com" />
        <p className="text-xs text-muted-foreground">Required to receive payouts.</p>
      </div>
      <Button className="w-full" onClick={save} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Save payout email
      </Button>
    </div>
  );
}
