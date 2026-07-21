"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, KeyRound } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { setInitialPassword } from "@/app/actions/affiliate";

export function SetPasswordForm({ email, home }: { email: string; home: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (next !== confirm) {
      toast("Passwords don't match.", "error");
      return;
    }
    start(async () => {
      const res = await setInitialPassword(next);
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      // Re-authenticate so the JWT picks up the cleared mustChangePassword flag
      // (authorize re-reads it from the DB), then middleware lets us through.
      const auth = await signIn("credentials", { email, password: next, redirect: false });
      if (auth?.error) {
        // Password is set — just send them to sign in fresh.
        router.push("/login");
        return;
      }
      router.push(home);
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>New password</Label>
        <Input name="next" type="password" required minLength={6} placeholder="••••••••" autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label>Confirm password</Label>
        <Input name="confirm" type="password" required minLength={6} placeholder="••••••••" autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <KeyRound className="size-4" /> Set password &amp; continue
          </>
        )}
      </Button>
    </form>
  );
}
