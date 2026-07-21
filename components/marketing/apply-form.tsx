"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PhoneVerify } from "@/components/marketing/phone-verify";
import { applyAsAffiliate, lookupCustomerForApply } from "@/app/actions/affiliate";

const BLANK = {
  name: "",
  companyName: "",
  channel: "Instagram",
  audienceSize: "Under 10k",
  handle: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const STEPS = ["Account", "About you", "Shipping"];

export function ApplyForm({ requirePhone = true }: { requirePhone?: boolean }) {
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(1); // 1 = account, 2 = profile, 3 = address + phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState(BLANK);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (patch: Partial<typeof BLANK>) => setFields((f) => ({ ...f, ...patch }));

  // When they leave the email field, pull anything the store already knows about
  // this customer and pre-fill it (best effort — silently does nothing if there's
  // no match or the store's customer data isn't readable).
  const onEmailBlur = () => {
    const e = email.trim().toLowerCase();
    if (!e || !EMAIL_RE.test(e)) return;
    setPrefilling(true);
    lookupCustomerForApply(e)
      .then((c) => {
        if (!c) return;
        // Only fill blanks — never clobber something they already typed.
        setFields((f) => ({
          ...f,
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

  const step1Valid = EMAIL_RE.test(email.trim()) && fields.name.trim().length >= 2 && password.length >= 6;

  const next = () => {
    if (step === 1 && !step1Valid) {
      toast("Enter your email, name, and a password (6+ characters) to continue.", "error");
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = () => {
    if (!step1Valid) {
      setStep(1);
      toast("Enter your email, name, and a password (6+ characters).", "error");
      return;
    }
    const input = {
      name: fields.name,
      email,
      password,
      companyName: fields.companyName,
      channel: fields.channel,
      audienceSize: fields.audienceSize,
      handle: fields.handle,
      applyNote: "",
      addressLine1: fields.addressLine1,
      addressLine2: fields.addressLine2,
      city: fields.city,
      region: fields.region,
      postalCode: fields.postalCode,
      country: fields.country,
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
        {/* Step progress */}
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = n === step;
            const complete = n < step;
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    active ? "bg-primary text-primary-foreground" : complete ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {complete ? <CheckCircle2 className="size-3.5" /> : n}
                </span>
                <span className={`hidden text-xs font-medium sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                {n < STEPS.length && <span className={`h-px flex-1 ${complete ? "bg-success/50" : "bg-hairline"}`} />}
              </div>
            );
          })}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); step === 3 ? submit() : next(); }} className="space-y-5">
          {/* ---------- Step 1 · account ---------- */}
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input name="email" required type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={onEmailBlur} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  Full name
                  {prefilling && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                </Label>
                <Input required placeholder="Your name" value={fields.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
              </div>
              {prefilled && (
                <p className="-mt-2 flex items-center gap-1.5 text-xs text-primary">
                  <Sparkles className="size-3.5" /> We found your details on file and filled them in — edit anything that's changed.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input required type="password" placeholder="Create a password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
            </>
          )}

          {/* ---------- Step 2 · profile ---------- */}
          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label>Company / brand (optional)</Label>
                <Input placeholder="Your brand" value={fields.companyName} onChange={(e) => set({ companyName: e.target.value })} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Primary channel</Label>
                  <select value={fields.channel} onChange={(e) => set({ channel: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                    <option>Instagram</option>
                    <option>TikTok</option>
                    <option>YouTube</option>
                    <option>Newsletter</option>
                    <option>Blog / Website</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Audience size</Label>
                  <select value={fields.audienceSize} onChange={(e) => set({ audienceSize: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                    <option>Under 10k</option>
                    <option>10k – 50k</option>
                    <option>50k – 250k</option>
                    <option>250k+</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Handle / link</Label>
                <Input placeholder="@yourhandle or yoursite.com" value={fields.handle} onChange={(e) => set({ handle: e.target.value })} />
              </div>
            </>
          )}

          {/* ---------- Step 3 · shipping + phone (skippable) ---------- */}
          {step === 3 && (
            <>
              <fieldset className="space-y-3 rounded-xl border border-hairline p-4">
                <legend className="px-1 text-sm font-medium">Shipping address for samples (optional)</legend>
                <p className="-mt-1 text-xs text-muted-foreground">Add this if you'd like to receive product samples. You can also fill it in later.</p>
                <div className="space-y-1.5">
                  <Label>Street address</Label>
                  <Input placeholder="123 Main St" value={fields.addressLine1} onChange={(e) => set({ addressLine1: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apt / suite (optional)</Label>
                  <Input placeholder="Apt 4B" value={fields.addressLine2} onChange={(e) => set({ addressLine2: e.target.value })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input placeholder="City" value={fields.city} onChange={(e) => set({ city: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>State / province</Label>
                    <Input placeholder="State" value={fields.region} onChange={(e) => set({ region: e.target.value })} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>ZIP / postal code</Label>
                    <Input placeholder="ZIP" value={fields.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Country</Label>
                    <Input placeholder="Country" value={fields.country} onChange={(e) => set({ country: e.target.value })} />
                  </div>
                </div>
              </fieldset>
              <div className="rounded-xl border border-hairline bg-muted/30 p-4">
                <PhoneVerify onVerified={setVerifiedPhone} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Optional — we pay commissions via Venmo to this number. You can add and verify it later in Settings.
                </p>
              </div>
            </>
          )}

          {/* ---------- Nav buttons ---------- */}
          <div className="flex items-center gap-3 pt-1">
            {step > 1 && (
              <Button type="button" variant="outline" size="lg" onClick={back} disabled={pending}>
                <ArrowLeft className="size-4" /> Back
              </Button>
            )}
            {step < 3 ? (
              <Button type="submit" size="lg" className="flex-1" disabled={step === 1 && !step1Valid}>
                Continue <ArrowRight className="size-4" />
              </Button>
            ) : (
              <div className="flex flex-1 items-center gap-3">
                <Button type="button" variant="ghost" size="lg" onClick={submit} disabled={pending}>
                  Skip for now
                </Button>
                <Button type="submit" size="lg" className="flex-1" disabled={pending}>
                  {pending ? (
                    <><Loader2 className="size-4 animate-spin" /> Submitting…</>
                  ) : (
                    <>Submit application <ArrowRight className="size-4" /></>
                  )}
                </Button>
              </div>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            By applying you agree to the Sipfluence partner terms.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
