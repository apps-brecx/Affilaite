import { ApplyForm } from "@/components/marketing/apply-form";
import { Ticket, Wallet, Zap, TrendingUp } from "lucide-react";

export const metadata = { title: "Become a Partner" };

const PERKS = [
  { icon: TrendingUp, title: "15–25% commission", body: "Competitive rates that grow as you do." },
  { icon: Wallet, title: "Paid via PayPal", body: "Fast, native payouts — no minimums drama." },
  { icon: Ticket, title: "Your own code & link", body: "Ready the moment you're approved." },
  { icon: Zap, title: "Bonuses & drops", body: "Time-boxed promos to boost your earnings." },
];

export default function ApplyPage() {
  return (
    <div className="relative">
      <div className="aurora pointer-events-none absolute inset-0 h-96" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
        {/* Left — pitch */}
        <div className="lg:pt-8">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Join the <span className="text-gradient-gold">partner program.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            Share what you love, earn on every sale. Applications are usually reviewed within 48 hours.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PERKS.map((p) => (
              <div key={p.title} className="flex gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-gilded">
                  <p.icon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <ApplyForm />
      </div>
    </div>
  );
}
