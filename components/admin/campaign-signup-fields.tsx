"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveCampaignSignup } from "@/app/actions/admin";
import { SIGNUP_FIELD_LABELS, type SignupFields, type FieldMode } from "@/lib/campaign-config";

const MODES: { value: FieldMode; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "optional", label: "Optional" },
  { value: "required", label: "Required" },
];

export function CampaignSignupFields({ campaignId, initial }: { campaignId: string; initial: SignupFields }) {
  const [s, setS] = useState<SignupFields>(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await saveCampaignSignup(campaignId, s);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="size-4 text-primary" /> What to collect at signup
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="-mt-2 mb-5 text-sm text-muted-foreground">
          Name, email, password and a verified mobile number are always asked. Choose what else this campaign&apos;s <code className="rounded bg-muted px-1 text-xs">/join</code> page
          collects — and whether it&apos;s required — even for people you invite directly.
        </p>
        <div className="divide-y divide-hairline rounded-xl border border-hairline">
          {SIGNUP_FIELD_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-medium">{label}</span>
              <div className="flex rounded-lg border border-hairline p-0.5">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setS((prev) => ({ ...prev, [key]: m.value }))}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      s[key] === m.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <ListChecks className="size-4" />} Save fields
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
