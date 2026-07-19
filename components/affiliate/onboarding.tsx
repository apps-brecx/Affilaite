import Link from "next/link";
import { Check, CreditCard, Link2, ShoppingBag, ArrowRight } from "lucide-react";
import type { Affiliate } from "@/lib/types";

/**
 * First-run getting-started checklist with a progress ring. Auto-hides once the
 * partner has completed all three steps.
 */
export function OnboardingChecklist({ me }: { me: Affiliate }) {
  const hasPayout = me.payoutMethod === "paypal" ? !!me.paypalEmail : !!me.phoneVerified;
  const hasShared = me.clicks > 0;
  const hasSale = me.orders > 0;
  const steps = [
    { done: hasPayout, label: "Set up how you get paid", hint: "Add your payout details", href: "/payouts", icon: CreditCard },
    { done: hasShared, label: "Grab your link & code", hint: "Share it to start earning", href: "/links", icon: Link2 },
    { done: hasSale, label: "Make your first sale", hint: "Browse products to promote", href: "/promotions", icon: ShoppingBag },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const pct = Math.round((doneCount / steps.length) * 100);
  const r = 26;
  const circ = 2 * Math.PI * r;

  return (
    <div className="rounded-2xl border border-hairline bg-gradient-to-br from-primary/[0.06] to-transparent p-5">
      <div className="flex items-center gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--hairline))" strokeWidth="6" />
            <circle cx="32" cy="32" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - doneCount / steps.length)} />
          </svg>
          <span className="absolute text-sm font-semibold tabular-nums">{pct}%</span>
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Welcome to the team 🎉</h2>
          <p className="text-sm text-muted-foreground">{doneCount} of {steps.length} done — finish setting up to start earning.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`group flex items-center gap-3 rounded-xl border p-3 transition-colors ${s.done ? "border-hairline bg-card/50" : "border-hairline bg-card hover:border-primary/40"}`}
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${s.done ? "bg-success text-success-foreground" : "bg-primary/10 text-primary"}`}>
              {s.done ? <Check className="size-4" /> : <s.icon className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm font-medium ${s.done ? "text-muted-foreground line-through" : ""}`}>{s.label}</p>
              {!s.done && <p className="truncate text-xs text-muted-foreground">{s.hint}</p>}
            </div>
            {!s.done && <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
