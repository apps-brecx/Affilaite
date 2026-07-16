"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createGroup } from "@/app/actions/admin";

export function GroupForm() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createGroup({
        name: String(fd.get("name") ?? ""),
        description: String(fd.get("description") ?? ""),
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        form.reset();
        router.refresh();
      }
    });
  };

  return (
    <Card className="h-fit border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Plus className="size-4" /> New group
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Holiday Crew" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea name="description" placeholder="Who belongs here and why…" />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Create group
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
