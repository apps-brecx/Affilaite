"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { setSetting } from "@/app/actions/admin";

export function PhoneVerificationToggle({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const toggle = () => {
    const next = !on;
    setOn(next);
    start(async () => {
      const res = await setSetting("require_phone_verification", next ? "true" : "false");
      if (res.ok) {
        toast(next ? "Phone verification is now required at signup." : "Phone verification turned off.", "success");
        router.refresh();
      } else {
        setOn(!next); // revert on failure
        toast(res.message, "error");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> Phone verification at signup
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Require new affiliates to verify a mobile number with an SMS code when they apply or join. The verified
          number is also used for Venmo payouts. You can turn this off anytime.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
        >
          <span className={`inline-flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`}>
            {pending && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
