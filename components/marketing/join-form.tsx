"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PhoneVerify } from "@/components/marketing/phone-verify";
import { joinCampaign } from "@/app/actions/affiliate";
import type { SignupFields } from "@/lib/campaign-config";

const req = (m: string) => m === "required";
const on = (m: string) => m !== "off";

export function JoinForm({
  slug,
  instantAccess,
  approvedMessage,
  signup,
}: {
  slug: string;
  instantAccess: boolean;
  approvedMessage?: string;
  signup: SignupFields;
}) {
  const [done, setDone] = useState<null | { instant: boolean }>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const phoneRequired = req(signup.phone);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phoneRequired && !verifiedPhone) {
      toast("Please verify your mobile number first.", "error");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const val = (k: string) => String(fd.get(k) ?? "");
    start(async () => {
      const res = await joinCampaign({
        slug,
        name: val("name"),
        email: val("email"),
        password: val("password"),
        companyName: val("companyName"),
        channel: val("channel"),
        audienceSize: val("audienceSize"),
        handle: val("handle"),
        addressLine1: val("addressLine1"),
        addressLine2: val("addressLine2"),
        city: val("city"),
        region: val("region"),
        postalCode: val("postalCode"),
        country: val("country"),
        phone: verifiedPhone ?? "",
      });
      if (res.ok) setDone({ instant: Boolean(res.instant) });
      else toast(res.message, "error");
    });
  };

  if (done) {
    return (
      <Card>
        <CardContent className="py-14 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
          >
            <CheckCircle2 className="size-8" />
          </motion.span>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {done.instant ? "You're in! 🎉" : "Application received"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            {done.instant
              ? approvedMessage || "Your partner account is ready. Sign in to grab your code and referral link."
              : "Thanks for applying. We'll review your details and email you once you're approved."}
          </p>
          {done.instant && (
            <Button asChild className="mt-6">
              <Link href="/login">Sign in <ArrowRight className="size-4" /></Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 sm:p-7">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input name="name" required placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input name="email" type="email" required placeholder="you@email.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Create a password</Label>
            <Input name="password" type="password" required minLength={6} placeholder="••••••••" />
          </div>

          {on(signup.companyName) && (
            <div className="space-y-1.5">
              <Label>Company / brand {!req(signup.companyName) && <span className="text-muted-foreground">(optional)</span>}</Label>
              <Input name="companyName" required={req(signup.companyName)} placeholder="Your brand" />
            </div>
          )}
          {(on(signup.channel) || on(signup.audienceSize)) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {on(signup.channel) && (
                <div className="space-y-1.5">
                  <Label>Primary channel {!req(signup.channel) && <span className="text-muted-foreground">(optional)</span>}</Label>
                  <select name="channel" required={req(signup.channel)} defaultValue="" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                    <option value="" disabled={req(signup.channel)}>{req(signup.channel) ? "Select…" : "—"}</option>
                    <option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Newsletter</option><option>Blog / Website</option>
                  </select>
                </div>
              )}
              {on(signup.audienceSize) && (
                <div className="space-y-1.5">
                  <Label>Audience size {!req(signup.audienceSize) && <span className="text-muted-foreground">(optional)</span>}</Label>
                  <select name="audienceSize" required={req(signup.audienceSize)} defaultValue="" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                    <option value="" disabled={req(signup.audienceSize)}>{req(signup.audienceSize) ? "Select…" : "—"}</option>
                    <option>Under 10k</option><option>10k – 50k</option><option>50k – 250k</option><option>250k+</option>
                  </select>
                </div>
              )}
            </div>
          )}
          {on(signup.handle) && (
            <div className="space-y-1.5">
              <Label>Handle / link {!req(signup.handle) && <span className="text-muted-foreground">(optional)</span>}</Label>
              <Input name="handle" required={req(signup.handle)} placeholder="@yourhandle or yoursite.com" />
            </div>
          )}
          {on(signup.address) && (
            <fieldset className="space-y-3 rounded-xl border border-hairline p-4">
              <legend className="px-1 text-sm font-medium">Shipping address {!req(signup.address) && <span className="text-muted-foreground">(optional)</span>}</legend>
              <Input name="addressLine1" required={req(signup.address)} placeholder="Street address" />
              <Input name="addressLine2" placeholder="Apt / suite (optional)" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="city" required={req(signup.address)} placeholder="City" />
                <Input name="region" placeholder="State / province" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="postalCode" required={req(signup.address)} placeholder="ZIP / postal code" />
                <Input name="country" required={req(signup.address)} placeholder="Country" />
              </div>
            </fieldset>
          )}

          {on(signup.phone) && (
            <div className="rounded-xl border border-hairline bg-muted/30 p-4">
              <PhoneVerify onVerified={setVerifiedPhone} />
              <p className="mt-2 text-xs text-muted-foreground">
                We pay commissions via Venmo to this number.{phoneRequired ? " Verification is required to join." : " Optional — you can add it later."}
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={pending || (phoneRequired && !verifiedPhone)}>
            {pending ? (
              <><Loader2 className="size-4 animate-spin" /> Joining…</>
            ) : (
              <>{instantAccess ? "Join now" : "Apply to join"} <ArrowRight className="size-4" /></>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already a partner?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
