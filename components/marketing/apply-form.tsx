"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PhoneVerify } from "@/components/marketing/phone-verify";
import { applyAsAffiliate } from "@/app/actions/affiliate";

export function ApplyForm({ requirePhone = true }: { requirePhone?: boolean }) {
  const [done, setDone] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (requirePhone && !verifiedPhone) {
      toast("Please verify your mobile number first.", "error");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const input = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      companyName: String(fd.get("companyName") ?? ""),
      channel: String(fd.get("channel") ?? ""),
      audienceSize: String(fd.get("audienceSize") ?? ""),
      handle: String(fd.get("handle") ?? ""),
      applyNote: String(fd.get("applyNote") ?? ""),
      phone: verifiedPhone ?? "",
    };
    start(async () => {
      const res = await applyAsAffiliate(input);
      if (res.ok) setDone(true);
      else toast(res.message, "error");
    });
  };

  if (done) {
    return (
      <Card className="flex items-center justify-center">
        <CardContent className="py-16 text-center">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success-soft text-success"
          >
            <CheckCircle2 className="size-8" />
          </motion.span>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Application received</h2>
          <p className="mx-auto mt-2 max-w-sm text-muted-foreground">
            Thanks for applying to the Sipfluence partner program. We'll review your details and email you
            once you're approved — then you can sign in and grab your code and link.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input name="name" required placeholder="Your name" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input name="email" required type="email" placeholder="you@email.com" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input name="password" required type="password" placeholder="Create a password" minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Company / brand (optional)</Label>
              <Input name="companyName" placeholder="Your brand" />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Primary channel</Label>
              <select name="channel" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option>Instagram</option>
                <option>TikTok</option>
                <option>YouTube</option>
                <option>Newsletter</option>
                <option>Blog / Website</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Audience size</Label>
              <select name="audienceSize" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option>Under 10k</option>
                <option>10k – 50k</option>
                <option>50k – 250k</option>
                <option>250k+</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Handle / link</Label>
            <Input name="handle" placeholder="@yourhandle or yoursite.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Why are you a great fit? (optional)</Label>
            <Textarea name="applyNote" placeholder="Tell us about your audience and how you'd promote Sipfluence…" />
          </div>
          <div className="rounded-xl border border-hairline bg-muted/30 p-4">
            <PhoneVerify onVerified={setVerifiedPhone} />
            <p className="mt-2 text-xs text-muted-foreground">
              We pay commissions via Venmo to this number, and use it to keep your account secure.
              {requirePhone && " Verification is required to apply."}
            </p>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={pending || (requirePhone && !verifiedPhone)}>
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : (
              <>
                Submit application <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            By applying you agree to the Sipfluence partner terms.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
