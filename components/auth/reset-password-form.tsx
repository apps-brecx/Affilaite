"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { resetPassword } from "@/app/actions/auth";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const router = useRouter();
  const toast = useToast();

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <p className="font-medium">Invalid reset link</p>
        <p className="text-sm text-muted-foreground">This link is missing its token. Request a new one.</p>
        <Button asChild variant="secondary" className="mt-1">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-success-soft text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <p className="font-medium">Password updated</p>
        <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <Button asChild className="mt-1">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password !== confirm) {
      toast("Passwords don't match.", "error");
      return;
    }
    start(async () => {
      const res = await resetPassword({ token, password });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2500);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>New password</Label>
        <Input name="password" type="password" required minLength={6} placeholder="••••••••" autoComplete="new-password" autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label>Confirm password</Label>
        <Input name="confirm" type="password" required minLength={6} placeholder="••••••••" autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Updating…
          </>
        ) : (
          <>
            <KeyRound className="size-4" /> Reset password
          </>
        )}
      </Button>
    </form>
  );
}
