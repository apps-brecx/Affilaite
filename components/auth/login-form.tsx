"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, LogIn } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function LoginForm() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    start(async () => {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        toast("Invalid email or password.", "error");
        return;
      }
      // Only follow same-site paths (a single leading slash) — never an
      // absolute URL or protocol-relative "//host", which would be an open redirect.
      const next = params.get("next");
      const safeNext = next && /^\/(?!\/)/.test(next) ? next : "/dashboard";
      router.push(safeNext);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input name="email" type="email" required placeholder="you@email.com" autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input name="password" type="password" required placeholder="••••••••" autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            <LogIn className="size-4" /> Sign in
          </>
        )}
      </Button>
    </form>
  );
}
