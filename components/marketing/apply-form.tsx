"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PhoneVerify } from "@/components/marketing/phone-verify";
import { applyAsAffiliate, lookupCustomerForApply } from "@/app/actions/affiliate";

const BLANK = { name: "", companyName: "", addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", country: "" };

export function ApplyForm({ requirePhone = true }: { requirePhone?: boolean }) {
  const [done, setDone] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [fields, setFields] = useState(BLANK);
  const [prefilling, setPrefilling] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const toast = useToast();
  const set = (patch: Partial<typeof BLANK>) => setFields((f) => ({ ...f, ...patch }));

  // When the applicant leaves the email field, pull anything the store already
  // knows about them and pre-fill it (best effort — silently does nothing if
  // there's no match or the store's customer data isn't readable).
  const onEmailBlur = () => {
    const e = email.trim().toLowerCase();
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return;
    setPrefilling(true);
    lookupCustomerForApply(e)
      .then((c) => {
        if (!c) return;
        // Only fill blanks — never clobber something the applicant already typed.
        setFields((f) => ({
          name: f.name || c.name,
          companyName: f.companyName || c.company,
          addressLine1: f.addressLine1 || c.addressLine1,
          addressLine2: f.addressLine2 || c.addressLine2,
          city: f.city || c.city,
          region: f.region || c.region,
          postalCode: f.postalCode || c.postalCode,
          country: f.country || c.country,
        }));
        if (c.name || c.addressLine1) setPrefilled(true);
      })
      .catch(() => {})
      .finally(() => setPrefilling(false));
  };

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
      addressLine1: String(fd.get("addressLine1") ?? ""),
      addressLine2: String(fd.get("addressLine2") ?? ""),
      city: String(fd.get("city") ?? ""),
      region: String(fd.get("region") ?? ""),
      postalCode: String(fd.get("postalCode") ?? ""),
      country: String(fd.get("country") ?? ""),
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
              <Label>Email</Label>
              <Input name="email" required type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={onEmailBlur} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                Full name
                {prefilling && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
              </Label>
              <Input name="name" required placeholder="Your name" value={fields.name} onChange={(e) => set({ name: e.target.value })} />
            </div>
          </div>
          {prefilled && (
            <p className="-mt-2 flex items-center gap-1.5 text-xs text-primary">
              <Sparkles className="size-3.5" /> We found your details on file and filled them in — edit anything that's changed.
            </p>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input name="password" required type="password" placeholder="Create a password" minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>Company / brand (optional)</Label>
              <Input name="companyName" placeholder="Your brand" value={fields.companyName} onChange={(e) => set({ companyName: e.target.value })} />
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
          <fieldset className="space-y-3 rounded-xl border border-hairline p-4">
            <legend className="px-1 text-sm font-medium">Shipping address for samples (optional)</legend>
            <p className="-mt-1 text-xs text-muted-foreground">Add this if you'd like to receive product samples. You can also fill it in later.</p>
            <div className="space-y-1.5">
              <Label>Street address</Label>
              <Input name="addressLine1" placeholder="123 Main St" value={fields.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Apt / suite (optional)</Label>
              <Input name="addressLine2" placeholder="Apt 4B" value={fields.addressLine2} onChange={(e) => set({ addressLine2: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input name="city" placeholder="City" value={fields.city} onChange={(e) => set({ city: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>State / province</Label>
                <Input name="region" placeholder="State" value={fields.region} onChange={(e) => set({ region: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>ZIP / postal code</Label>
                <Input name="postalCode" placeholder="ZIP" value={fields.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Input name="country" placeholder="Country" value={fields.country} onChange={(e) => set({ country: e.target.value })} />
              </div>
            </div>
          </fieldset>
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
