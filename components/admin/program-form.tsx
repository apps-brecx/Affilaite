"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Star, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { createProgram, updateProgram, setDefaultProgram } from "@/app/actions/admin";
import type { Program } from "@/lib/types";

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

/** Inline "Edit" that opens the program form pre-filled for an existing program. */
export function EditProgramButton({ program }: { program: Program }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit
      </Button>
    );
  }
  return (
    <div className="mt-3">
      <ProgramForm program={program} onDone={() => setOpen(false)} />
    </div>
  );
}

export function ProgramForm({ program, onDone }: { program?: Program; onDone?: () => void }) {
  const editing = !!program;
  const [pending, start] = useTransition();
  const [newCustomerOnly, setNewCustomerOnly] = useState(program?.newCustomerOnly ?? false);
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      name: String(fd.get("name") ?? ""),
      commissionType: String(fd.get("commissionType") ?? "percent"),
      commissionValue: String(fd.get("commissionValue") ?? ""),
      cookieWindowDays: String(fd.get("cookieWindowDays") ?? "30"),
      holdDays: String(fd.get("holdDays") ?? "30"),
      payoutMinimum: String(fd.get("payoutMinimum") ?? "0"),
      newCustomerOnly,
    };
    start(async () => {
      const res = editing ? await updateProgram(program!.id, payload) : await createProgram(payload);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        if (!editing) form.reset();
        setNewCustomerOnly(editing ? newCustomerOnly : false);
        router.refresh();
        onDone?.();
      }
    });
  };

  return (
    <Card className={editing ? "" : "border-dashed"}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-muted-foreground">
          {editing ? <Pencil className="size-4" /> : <Plus className="size-4" />} {editing ? `Edit ${program!.name}` : "New program"}
        </CardTitle>
        {editing && onDone && (
          <Button variant="ghost" size="sm" onClick={onDone}><X className="size-4" /></Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Holiday Partners" defaultValue={program?.name} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select name="commissionType" defaultValue={program?.commissionType ?? "percent"} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option value="percent">Percent</option>
                <option value="flat">Flat</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Value</Label>
              <Input name="commissionValue" type="number" step="0.01" required placeholder="15" defaultValue={program?.commissionValue} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cookie days</Label>
              <Input name="cookieWindowDays" type="number" defaultValue={program?.cookieWindowDays ?? 30} />
            </div>
            <div className="space-y-1.5">
              <Label>Hold days</Label>
              <Input name="holdDays" type="number" defaultValue={program?.holdDays ?? 30} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Payout minimum ($)</Label>
            <Input name="payoutMinimum" type="number" step="0.01" defaultValue={program?.payoutMinimum ?? 0} />
            <p className="text-xs text-muted-foreground">Affiliates must clear this in approved commissions before a payout runs. Set to 0 to pay any amount.</p>
          </div>
          <Switch
            checked={newCustomerOnly}
            onCheckedChange={setNewCustomerOnly}
            label="New customers only"
            description="Only pay commission on a customer's first order"
          />
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} {editing ? "Save changes" : "Create program"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
