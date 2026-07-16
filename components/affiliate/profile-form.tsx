"use client";

import { useState, useTransition } from "react";
import { Instagram, Globe, Loader2, Phone, Mail, MapPin } from "lucide-react";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { updateProfile } from "@/app/actions/affiliate";
import type { Affiliate } from "@/lib/types";

export function ProfileForm({ me }: { me: Affiliate }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateProfile({
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        address: String(fd.get("address") ?? ""),
        companyName: String(fd.get("companyName") ?? ""),
        instagram: String(fd.get("instagram") ?? ""),
        website: String(fd.get("website") ?? ""),
      });
      toast(res.message, res.ok ? "success" : "error");
    });
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={me.name} size={64} />
        <div>
          <p className="font-medium">{me.name}</p>
          <p className="text-sm text-muted-foreground">{me.email}</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input name="name" defaultValue={me.name} required />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="email" type="email" className="pl-9" defaultValue={me.email} required />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Mobile number</Label>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="phone" type="tel" className="pl-9" defaultValue={me.phone ?? ""} placeholder="+1 555 123 4567" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Company (optional)</Label>
          <Input name="companyName" defaultValue={me.companyName ?? ""} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Shipping address (for samples)</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Textarea name="address" className="pl-9" rows={2} defaultValue={me.address ?? ""} placeholder="Street, city, state, ZIP, country" />
          </div>
          <p className="text-[11px] text-muted-foreground">Add this if you&apos;d like to receive product samples (coming soon).</p>
        </div>
        <div className="space-y-1.5">
          <Label>Instagram</Label>
          <div className="relative">
            <Instagram className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="instagram" className="pl-9" defaultValue={me.socialLinks.instagram ?? ""} placeholder="@yourhandle" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Website</Label>
          <div className="relative">
            <Globe className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="website" className="pl-9" defaultValue={me.socialLinks.website ?? ""} placeholder="yoursite.com" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Referral code</Label>
          <Input value={me.code} disabled />
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save changes
        </Button>
      </div>
    </form>
  );
}
