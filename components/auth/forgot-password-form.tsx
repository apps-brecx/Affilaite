"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { requestPasswordReset } from "@/app/actions/auth";

export function ForgotPasswordForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    start(async () => {
      await requestPasswordReset({ email });
      setDone(true);
    });
  };

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" required placeholder="you@email.com" autoComplete="email" autoFocus />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending…
          </>
        ) : (
          <>
            <Mail className="size-4" /> Send reset link
          </>
        )}
      </Button>
    </form>
  );
}
