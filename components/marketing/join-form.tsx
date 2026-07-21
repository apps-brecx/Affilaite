"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { PhoneVerify } from "@/components/marketing/phone-verify";
import { joinCampaign, lookupCustomerForApply } from "@/app/actions/affiliate";
import type { SignupFields } from "@/lib/campaign-config";

const req = (m: string) => m === "required";
const on = (m: string) => m !== "off";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const BLANK = {
  name: "",
  companyName: "",
  channel: "",
  audienceSize: "",
  handle: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
};

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
  const [step, setStep] = useState(1); // 1 = account, 2 = about you, 3 = shipping + phone
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState(BLANK);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [prefilling, setPrefilling] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const set = (patch: Partial<typeof BLANK>) => setFields((f) => ({ ...f, ...patch }));

  // Which optional/required fields the campaign asks for in step 2.
  const hasAbout = on(signup.companyName) || on(signup.channel) || on(signup.audienceSize) || on(signup.handle);
  const STEPS = ["Account", "About you", "Shipping"];

  // Pre-fill from an existing store customer when they leave the email field.
  const onEmailBlur = () => {
    const e = email.trim().toLowerCase();
    if (!e || !EMAIL_RE.test(e)) return;
    setPrefilling(true);
    lookupCustomerForApply(e)
      .then((c) => {
        if (!c) return;
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
  const step2Valid =
    (!req(signup.companyName) || fields.companyName.trim()) &&
    (!req(signup.channel) || fields.channel.trim()) &&
    (!req(signup.audienceSize) || fields.audienceSize.trim()) &&
    (!req(signup.handle) || fields.handle.trim());
  const addressComplete = fields.addressLine1.trim() && fields.city.trim() && fields.country.trim();

  const next = () => {
    if (step === 1 && !step1Valid) {
      toast("Enter your email, name, and a password (6+ characters) to continue.", "error");
      return;
    }
    if (step === 2 && !step2Valid) {
      toast("Please fill in the required fields to continue.", "error");
      return;
    }
    // Skip the empty "About you" step when the campaign asks for none of it.
    setStep((s) => (s === 1 && !hasAbout ? 3 : Math.min(3, s + 1)));
  };
  const back = () => setStep((s) => (s === 3 && !hasAbout ? 1 : Math.max(1, s - 1)));

  const submit = () => {
    if (!step1Valid) {
      setStep(1);
      toast("Enter your email, name, and a password (6+ characters).", "error");
      return;
    }
    if (!verifiedPhone) {
      toast("Please verify your mobile number to continue.", "error");
      return;
    }
    if (req(signup.address) && !addressComplete) {
      toast("Please enter your shipping address to continue.", "error");
      return;
    }
    start(async () => {
      const res = await joinCampaign({
        slug,
        name: fields.name,
        email,
        password,
        companyName: fields.companyName,
        channel: fields.channel,
        audienceSize: fields.audienceSize,
        handle: fields.handle,
        addressLine1: fields.addressLine1,
        addressLine2: fields.addressLine2,
        city: fields.city,
        region: fields.region,
        postalCode: fields.postalCode,
        country: fields.country,
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
                <Label>Create a password</Label>
                <Input required type="password" placeholder="••••••••" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
            </>
          )}

          {/* ---------- Step 2 · about you (campaign-configured) ---------- */}
          {step === 2 && (
            <>
              {on(signup.companyName) && (
                <div className="space-y-1.5">
                  <Label>Company / brand {!req(signup.companyName) && <span className="text-muted-foreground">(optional)</span>}</Label>
                  <Input placeholder="Your brand" value={fields.companyName} onChange={(e) => set({ companyName: e.target.value })} />
                </div>
              )}
              {(on(signup.channel) || on(signup.audienceSize)) && (
                <div className="grid gap-5 sm:grid-cols-2">
                  {on(signup.channel) && (
                    <div className="space-y-1.5">
                      <Label>Primary channel {!req(signup.channel) && <span className="text-muted-foreground">(optional)</span>}</Label>
                      <select value={fields.channel} onChange={(e) => set({ channel: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                        <option value="">{req(signup.channel) ? "Select…" : "—"}</option>
                        <option>Instagram</option><option>TikTok</option><option>YouTube</option><option>Newsletter</option><option>Blog / Website</option>
                      </select>
                    </div>
                  )}
                  {on(signup.audienceSize) && (
                    <div className="space-y-1.5">
                      <Label>Audience size {!req(signup.audienceSize) && <span className="text-muted-foreground">(optional)</span>}</Label>
                      <select value={fields.audienceSize} onChange={(e) => set({ audienceSize: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                        <option value="">{req(signup.audienceSize) ? "Select…" : "—"}</option>
                        <option>Under 10k</option><option>10k – 50k</option><option>50k – 250k</option><option>250k+</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
              {on(signup.handle) && (
                <div className="space-y-1.5">
                  <Label>Handle / link {!req(signup.handle) && <span className="text-muted-foreground">(optional)</span>}</Label>
                  <Input placeholder="@yourhandle or yoursite.com" value={fields.handle} onChange={(e) => set({ handle: e.target.value })} />
                </div>
              )}
            </>
          )}

          {/* ---------- Step 3 · phone (required) + shipping ---------- */}
          {step === 3 && (
            <>
              <div className="rounded-xl border border-hairline bg-muted/30 p-4">
                <PhoneVerify onVerified={setVerifiedPhone} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Required — we pay commissions via Venmo to this number.
                </p>
              </div>
              {on(signup.address) && (
                <fieldset className="space-y-3 rounded-xl border border-hairline p-4">
                  <legend className="px-1 text-sm font-medium">Shipping address {!req(signup.address) && <span className="text-muted-foreground">(optional)</span>}</legend>
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
              )}
            </>
          )}

          {/* ---------- Nav buttons ---------- */}
          {step < 3 ? (
            <div className="flex items-center gap-3 pt-1">
              {step > 1 && (
                <Button type="button" variant="outline" size="lg" onClick={back} disabled={pending}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
              )}
              <Button type="submit" size="lg" className="flex-1" disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}>
                Continue <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <Button type="submit" size="lg" className="w-full" disabled={pending || !verifiedPhone || (req(signup.address) && !addressComplete)}>
                {pending ? (
                  <><Loader2 className="size-4 animate-spin" /> {instantAccess ? "Joining…" : "Submitting…"}</>
                ) : (
                  <>{instantAccess ? "Join now" : "Apply to join"} <ArrowRight className="size-4" /></>
                )}
              </Button>
              <div className="flex items-center justify-between">
                <Button type="button" variant="outline" size="sm" onClick={back} disabled={pending}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
                {on(signup.address) && !req(signup.address) && (
                  <Button type="button" variant="secondary" size="sm" onClick={submit} disabled={pending || !verifiedPhone}>
                    Skip address for now
                  </Button>
                )}
              </div>
              {!verifiedPhone && (
                <p className="text-center text-xs text-muted-foreground">Verify your mobile number above to continue.</p>
              )}
            </div>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Already a partner?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
