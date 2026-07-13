"use client";

import { useState } from "react";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ApplyForm() {
  const [state, setState] = useState<"form" | "submitting" | "done">("form");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setState("submitting");
    setTimeout(() => setState("done"), 1400);
  };

  if (state === "done") {
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
            Thanks for applying. We'll review your details and email you within 48 hours. Keep an eye on
            your inbox for your unique code and link.
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
              <Input required placeholder="Sarah Whitfield" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input required type="email" placeholder="you@email.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Company / brand (optional)</Label>
            <Input placeholder="The Edit" />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Primary channel</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option>Instagram</option>
                <option>TikTok</option>
                <option>YouTube</option>
                <option>Newsletter</option>
                <option>Blog / Website</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Audience size</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                <option>Under 10k</option>
                <option>10k – 50k</option>
                <option>50k – 250k</option>
                <option>250k+</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Handle / link</Label>
            <Input placeholder="@yourhandle or yoursite.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Why are you a great fit? (optional)</Label>
            <Textarea placeholder="Tell us about your audience and how you'd promote us…" />
          </div>
          <div className="space-y-1.5">
            <Label>PayPal email (for payouts)</Label>
            <Input type="email" placeholder="you@paypal.com" />
          </div>

          {state === "submitting" ? (
            <Button disabled className="w-full" size="lg">
              <Loader2 className="size-4 animate-spin" /> Submitting…
            </Button>
          ) : (
            <Button type="submit" className="w-full" size="lg">
              Submit application <ArrowRight className="size-4" />
            </Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            By applying you agree to our program terms. No spam, ever.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
