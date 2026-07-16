"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateAffiliateInfo } from "@/app/actions/admin";
import type { Affiliate } from "@/lib/types";

export function EditAffiliateInfo({ affiliate }: { affiliate: Affiliate }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit info
      </Button>
    );
  }

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateAffiliateInfo(affiliate.id, {
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        addressLine1: String(fd.get("addressLine1") ?? ""),
        addressLine2: String(fd.get("addressLine2") ?? ""),
        city: String(fd.get("city") ?? ""),
        region: String(fd.get("region") ?? ""),
        postalCode: String(fd.get("postalCode") ?? ""),
        country: String(fd.get("country") ?? ""),
        paypalEmail: String(fd.get("paypalEmail") ?? ""),
        companyName: String(fd.get("companyName") ?? ""),
      });
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-hairline bg-muted/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>Name</Label><Input name="name" defaultValue={affiliate.name} required /></div>
        <div className="space-y-1"><Label>Email</Label><Input name="email" type="email" defaultValue={affiliate.email} required /></div>
        <div className="space-y-1"><Label>Mobile number</Label><Input name="phone" type="tel" defaultValue={affiliate.phone ?? ""} placeholder="+1 555 123 4567" /></div>
        <div className="space-y-1"><Label>PayPal email</Label><Input name="paypalEmail" type="email" defaultValue={affiliate.paypalEmail ?? ""} placeholder="Optional" /></div>
        <div className="space-y-1"><Label>Company</Label><Input name="companyName" defaultValue={affiliate.companyName ?? ""} placeholder="Optional" /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Street address</Label><Input name="addressLine1" defaultValue={affiliate.addressLine1 ?? ""} placeholder="123 Main St" /></div>
        <div className="space-y-1 sm:col-span-2"><Label>Apt / suite</Label><Input name="addressLine2" defaultValue={affiliate.addressLine2 ?? ""} placeholder="Optional" /></div>
        <div className="space-y-1"><Label>City</Label><Input name="city" defaultValue={affiliate.city ?? ""} /></div>
        <div className="space-y-1"><Label>State / province</Label><Input name="region" defaultValue={affiliate.region ?? ""} /></div>
        <div className="space-y-1"><Label>ZIP / postal code</Label><Input name="postalCode" defaultValue={affiliate.postalCode ?? ""} /></div>
        <div className="space-y-1"><Label>Country</Label><Input name="country" defaultValue={affiliate.country ?? ""} /></div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
          <X className="size-4" /> Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
      </div>
    </form>
  );
}
