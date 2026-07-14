"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { joinCampaign } from "@/app/actions/affiliate";

export function JoinForm({
  slug,
  instantAccess,
  approvedMessage,
}: {
  slug: string;
  instantAccess: boolean;
  approvedMessage?: string;
}) {
  const [done, setDone] = useState<null | { instant: boolean }>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await joinCampaign({
        slug,
        name: String(fd.get("name") ?? ""),
        email: String(fd.get("email") ?? ""),
        password: String(fd.get("password") ?? ""),
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
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
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
