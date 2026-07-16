"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { User, KeyRound, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { updateAdminAccount, changeAdminPassword } from "@/app/actions/admin";

export function AccountSettings({ name, email }: { name: string; email: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const saveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateAdminAccount({ name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? "") });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
  };

  const savePassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await changeAdminPassword({ current: String(fd.get("current") ?? ""), next: String(fd.get("next") ?? "") });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) form.reset();
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="max-w-xl space-y-5">
            <div className="flex items-center gap-4">
              <Avatar name={name} size={56} />
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-sm text-muted-foreground">Administrator</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input name="name" defaultValue={name} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={email} required />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={savePassword} className="max-w-md space-y-4">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <Input name="current" type="password" required autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input name="next" type="password" required minLength={6} autoComplete="new-password" />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null} Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
