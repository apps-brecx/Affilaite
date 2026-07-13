import Link from "next/link";
import {
  ArrowRight,
  Ticket,
  Wallet,
  Link2,
  RefreshCcw,
  Users,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Quote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/marketing/reveal";
import { CountUp } from "@/components/ui/count-up";

const FEATURES = [
  {
    icon: Ticket,
    title: "Coupon-first attribution",
    body: "Every affiliate gets a unique code and link. Codes survive cross-device and Safari — so you stop losing commissions to broken cookies.",
  },
  {
    icon: Wallet,
    title: "Native PayPal payouts",
    body: "Pay everyone in one batch, straight to PayPal. No Tremendous, no Tipalti, no middleman fees eating your margins.",
  },
  {
    icon: RefreshCcw,
    title: "Refunds claw back automatically",
    body: "When an order is refunded, the commission reverses itself. No spreadsheets, no manual clean-up, no overpaying.",
  },
  {
    icon: Ticket,
    title: "Bulk code generator",
    body: "Mint a trackable Shopify discount for every affiliate in one pass, throttled to respect rate limits.",
  },
  {
    icon: Users,
    title: "Groups & broadcasts",
    body: "Segment partners and send personalized, on-brand emails — bonuses, drops, and news that actually convert.",
  },
  {
    icon: BarChart3,
    title: "Analytics that matter",
    body: "Top affiliates, conversion rate, EPC, refund rate — the numbers that tell you where growth is really coming from.",
  },
];

const STEPS = [
  { n: "01", title: "Affiliate shares", body: "They post their code SARAH15 or referral link anywhere — stories, newsletters, videos." },
  { n: "02", title: "Customer buys", body: "The code is applied at checkout. Attribution is instant and reliable — no cookie required." },
  { n: "03", title: "You approve & pay", body: "Commission clears the hold window, then goes out in a one-click PayPal batch." },
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
              <Sparkles className="size-3.5" /> The affiliate platform for serious brands
            </Badge>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mx-auto max-w-4xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Turn your customers into a{" "}
              <span className="text-gradient-gold">revenue engine.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Affilaite connects to your Shopify store, tracks every sale with coupon-first accuracy,
              and pays partners natively through PayPal. Built for brands that treat affiliates like a
              business — not an afterthought.
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
                <Link href="/admin">Explore the platform</Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-success" /> HMAC-verified webhooks · idempotent payouts · encrypted at rest
            </p>
          </Reveal>
        </div>
      </section>

      {/* Numbers */}
      <section id="numbers" className="border-y border-hairline bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-14 sm:px-6 lg:grid-cols-4">
          {[
            { label: "Revenue via affiliates", value: 486240, format: "currency" as const, prefix: "" },
            { label: "Active partners", value: 71, format: "number" as const },
            { label: "Commission accuracy", value: 99.4, format: "raw" as const, suffix: "%" },
            { label: "Avg. payout cost", value: 1, format: "currency" as const, prefix: "~" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 0.05} className="text-center">
              <p className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
                <CountUp value={s.value} format={s.format} prefix={s.prefix} suffix={s.suffix} decimals={s.format === "raw" ? 1 : undefined} />
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight">
            Everything a program needs. Nothing it doesn't.
          </h2>
          <p className="mt-4 text-muted-foreground">
            The features that separate a real affiliate business from a spreadsheet — designed to be fast,
            reliable, and genuinely pleasant to use.
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
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-4xl font-semibold tracking-tight">One clean loop</h2>
            <p className="mt-4 text-muted-foreground">
              Click or code → order → commission → payout. That single working loop is 80% of the value.
            </p>
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

      {/* Testimonial */}
      <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
        <Reveal>
          <Quote className="mx-auto size-8 text-gold" />
          <blockquote className="mt-6 font-display text-2xl font-medium leading-relaxed tracking-tight sm:text-3xl">
            “We moved 71 creators onto Affilaite in a weekend. Payouts that used to take a day now take
            one click — and we stopped losing commissions to broken tracking.”
          </blockquote>
          <p className="mt-6 text-sm text-muted-foreground">Founder, direct-to-consumer apparel brand</p>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-primary px-8 py-16 text-center text-primary-foreground">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background:radial-gradient(60%_60%_at_50%_0%,white,transparent)]" />
            <h2 className="relative font-display text-4xl font-semibold tracking-tight">
              Ready to build your revenue engine?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/80">
              Join the program and start earning on every sale you drive. Your link and code are ready the
              moment you're approved.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" variant="gold" asChild>
                <Link href="/apply">
                  Apply now <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 border-primary-foreground/20">
                <Link href="/dashboard">See the portal</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
