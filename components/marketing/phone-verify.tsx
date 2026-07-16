"use client";

import { useState, useTransition } from "react";
import { Phone, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { requestPhoneCode, verifyPhoneCode } from "@/app/actions/phone";

/**
 * Phone-number + SMS-code verification. Calls `onVerified(phone)` once the code
 * is confirmed, and `onVerified(null)` if the number is edited afterwards.
 */
export function PhoneVerify({
  onVerified,
  initialPhone = "",
  label = "Mobile number (for Venmo payouts)",
}: {
  onVerified: (phone: string | null) => void;
  initialPhone?: string;
  label?: string;
}) {
  const [phone, setPhone] = useState(initialPhone);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const onPhoneChange = (v: string) => {
    setPhone(v);
    if (verified) {
      setVerified(false);
      setSent(false);
      setCode("");
      onVerified(null);
    }
  };

  const send = () =>
    start(async () => {
      const res = await requestPhoneCode(phone);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) setSent(true);
    });

  const verify = () =>
    start(async () => {
      const res = await verifyPhoneCode({ phone, code });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setVerified(true);
        onVerified(phone);
      }
    });

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+1 555 123 4567"
            className="pl-9"
            disabled={verified}
          />
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> Verified
          </span>
        ) : (
          <Button type="button" variant="outline" onClick={send} disabled={pending || phone.trim().length < 6}>
            {pending && !sent ? <Loader2 className="size-4 animate-spin" /> : null}
            {sent ? "Resend" : "Send code"}
          </Button>
        )}
      </div>

      {sent && !verified && (
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            className="flex-1 tracking-[0.3em]"
          />
          <Button type="button" onClick={verify} disabled={pending || code.length !== 6}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Verify
          </Button>
        </div>
      )}
    </div>
  );
}
