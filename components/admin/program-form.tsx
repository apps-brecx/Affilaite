"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { createProgram, setDefaultProgram } from "@/app/actions/admin";

export function SetDefaultButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setDefaultProgram(id);
          toast(res.message, res.ok ? "success" : "error");
          router.refresh();
        })
      }
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />} Set default
    </Button>
  );
}

export function ProgramForm() {
  const [pending, start] = useTransition();
  const [newCustomerOnly, setNewCustomerOnly] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createProgram({
        name: String(fd.get("name") ?? ""),
        commissionType: String(fd.get("commissionType") ?? "percent"),
        commissionValue: String(fd.get("commissionValue") ?? ""),
        cookieWindowDays: String(fd.get("cookieWindowDays") ?? "30"),
        holdDays: String(fd.get("holdDays") ?? "30"),
        newCustomerOnly,
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        form.reset();
        setNewCustomerOnly(false);
        router.refresh();
      }
    });
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          <Plus className="size-4" /> New program
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Holiday Partners" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select name="commissionType" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input name="commissionValue" type="number" step="0.01" required placeholder="15" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cookie days</Label>
              <Input name="cookieWindowDays" type="number" defaultValue={30} />
            </div>
            <div className="space-y-1.5">
              <Label>Hold days</Label>
              <Input name="holdDays" type="number" defaultValue={30} />
            </div>
          </div>
          <Switch
            checked={newCustomerOnly}
            onCheckedChange={setNewCustomerOnly}
            label="New customers only"
            description="Only pay commission on a customer's first order"
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Create program
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
