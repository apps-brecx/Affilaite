"use client";

import { useState, useTransition } from "react";
import { Instagram, Globe, Loader2, Phone, Mail, MapPin, Youtube, Music2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
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
        addressLine1: String(fd.get("addressLine1") ?? ""),
        addressLine2: String(fd.get("addressLine2") ?? ""),
        city: String(fd.get("city") ?? ""),
        region: String(fd.get("region") ?? ""),
        postalCode: String(fd.get("postalCode") ?? ""),
        country: String(fd.get("country") ?? ""),
        companyName: String(fd.get("companyName") ?? ""),
        instagram: String(fd.get("instagram") ?? ""),
        youtube: String(fd.get("youtube") ?? ""),
        tiktok: String(fd.get("tiktok") ?? ""),
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
        <fieldset className="space-y-3 rounded-xl border border-hairline p-4 sm:col-span-2">
          <legend className="flex items-center gap-1.5 px-1 text-sm font-medium">
            <MapPin className="size-4 text-muted-foreground" /> Shipping address (for samples)
          </legend>
          <div className="space-y-1.5">
            <Label>Street address</Label>
            <Input name="addressLine1" defaultValue={me.addressLine1 ?? ""} placeholder="123 Main St" />
          </div>
          <div className="space-y-1.5">
            <Label>Apt / suite (optional)</Label>
            <Input name="addressLine2" defaultValue={me.addressLine2 ?? ""} placeholder="Apt 4B" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input name="city" defaultValue={me.city ?? ""} placeholder="City" />
            </div>
            <div className="space-y-1.5">
              <Label>State / province</Label>
              <Input name="region" defaultValue={me.region ?? ""} placeholder="State" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>ZIP / postal code</Label>
              <Input name="postalCode" defaultValue={me.postalCode ?? ""} placeholder="ZIP" />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input name="country" defaultValue={me.country ?? ""} placeholder="Country" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">Add this if you&apos;d like to receive product samples.</p>
        </fieldset>
        <div className="space-y-1.5">
          <Label>Instagram</Label>
          <div className="relative">
            <Instagram className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="instagram" className="pl-9" defaultValue={me.socialLinks.instagram ?? ""} placeholder="@yourhandle" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>YouTube</Label>
          <div className="relative">
            <Youtube className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="youtube" className="pl-9" defaultValue={me.socialLinks.youtube ?? ""} placeholder="youtube.com/@yourchannel" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>TikTok</Label>
          <div className="relative">
            <Music2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="tiktok" className="pl-9" defaultValue={me.socialLinks.tiktok ?? ""} placeholder="@yourhandle" />
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
