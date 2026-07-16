import Link from "next/link";
import {
  ArrowRight,
  Ticket,
  Wallet,
  RefreshCcw,
  Users,
  BarChart3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/marketing/reveal";

const FEATURES = [
  {
    icon: Ticket,
    title: "Your own code & link",
    body: "Every partner gets a unique discount code and referral link. Codes work across every device — no cookies to lose.",
  },
  {
    icon: Wallet,
    title: "Paid via PayPal",
    body: "Approved earnings go straight to your PayPal in secure batches. No third-party middlemen, no surprise fees.",
  },
  {
    icon: RefreshCcw,
    title: "Fair & transparent",
    body: "See every click, order, and commission in real time. Refunds are handled automatically — no guesswork.",
  },
  {
    icon: BarChart3,
    title: "Clear analytics",
    body: "Track your clicks, conversion, and earnings per click in one clean dashboard built for your phone.",
  },
  {
    icon: Users,
    title: "Bonuses & drops",
    body: "Time-boxed promotions and creative assets, delivered straight to your portal when they go live.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    body: "HMAC-verified tracking, idempotent payouts, and your details stored securely and never shared.",
  },
];

const STEPS = [
  { n: "01", title: "Apply", body: "Tell us about your audience. We review applications within 48 hours." },
  { n: "02", title: "Share", body: "Post your Sipfluence code or link. Every sale is tracked to you automatically." },
  { n: "03", title: "Get paid", body: "Approved commissions are paid straight to your PayPal — one clean loop." },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="aurora pointer-events-none absolute inset-0" />
        <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
          <Reveal>
            <Badge variant="gold" className="mx-auto mb-6 px-3 py-1">
              <Sparkles className="size-3.5" /> The Sipfluence Partner Program
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mx-auto max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Partner with Sipfluence.{" "}
              <span className="text-gradient-gold">Earn on every sale.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Share what you love and earn commission on every order you drive. Coupon-first tracking,
              honest analytics, and native PayPal payouts — in a portal built for creators.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/apply">
                  Become a partner <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/login">Partner sign in</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight">Built for partners</h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need to promote Sipfluence and get paid — nothing you don't.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-lg border border-hairline bg-card p-6 shadow-card transition-shadow hover:shadow-lift">
                <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-gilded">
                  <f.icon className="size-5" />
                </span>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-hairline bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight">One clean loop</h2>
            <p className="mt-4 text-muted-foreground">Apply, share, get paid. That's the whole thing.</p>
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.08}>
                <div className="relative h-full rounded-lg border border-hairline bg-background p-7">
                  <span className="font-display text-5xl font-semibold text-primary/15">{s.n}</span>
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary px-8 py-16 text-center text-primary-foreground">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(60%_60%_at_50%_0%,white,transparent)]" />
            <h2 className="relative font-display text-4xl font-semibold tracking-tight">
              Ready to join the program?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Apply today. Once you're approved, your code and link are ready in the portal.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="gold" asChild>
                <Link href="/apply">
                  Apply now <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
