"use client";

import { useTransition } from "react";
import { Loader2, KeyRound } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { changePassword } from "@/app/actions/affiliate";

export function ChangePassword() {
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const next = String(fd.get("next") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (next !== confirm) {
      toast("Passwords don't match.", "error");
      return;
    }
    start(async () => {
      const res = await changePassword({ current: String(fd.get("current") ?? ""), next });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) form.reset();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Current password</Label>
        <Input name="current" type="password" required autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <Label>New password</Label>
        <Input name="next" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label>Confirm new password</Label>
        <Input name="confirm" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Change password
        </Button>
      </div>
    </form>
  );
}
