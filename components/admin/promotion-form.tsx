"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { createPromotion } from "@/app/actions/admin";

export function PromotionForm() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const res = await createPromotion({
        name: String(fd.get("name") ?? ""),
        bonusType: "percent",
        bonusValue: String(fd.get("bonusValue") ?? ""),
        startsAt: String(fd.get("startsAt") ?? ""),
        endsAt: String(fd.get("endsAt") ?? ""),
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
          <Plus className="size-4" /> New promotion
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required placeholder="e.g. Black Friday Boost" />
          </div>
          <div className="space-y-1.5">
            <Label>Bonus %</Label>
            <Input name="bonusValue" type="number" step="0.1" required placeholder="5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <Input name="startsAt" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input name="endsAt" type="date" required />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Launch promotion
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
