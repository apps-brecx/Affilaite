"use client";

import { useState, useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { updateNotificationPrefs } from "@/app/actions/affiliate";

const ITEMS = [
  { key: "newCommission", label: "New commission", description: "When a sale is attributed to you" },
  { key: "payoutSent", label: "Payout sent", description: "When money is on its way" },
  { key: "programUpdates", label: "Program updates", description: "Bonuses, promos & news" },
] as const;

export function NotificationPrefs({ prefs }: { prefs: Record<string, boolean> }) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ITEMS.map((i) => [i.key, prefs[i.key] !== false])),
  );
  const [, start] = useTransition();
  const toast = useToast();

  const set = (key: string, v: boolean) => {
    const next = { ...state, [key]: v };
    setState(next);
    start(async () => {
      const res = await updateNotificationPrefs(next);
      if (!res.ok) {
        setState(state); // revert
        toast(res.message, "error");
      }
    });
  };

  return (
    <div className="space-y-5">
      {ITEMS.map((i) => (
        <Switch
          key={i.key}
          checked={state[i.key]}
          onCheckedChange={(v) => set(i.key, v)}
          label={i.label}
          description={i.description}
        />
      ))}
    </div>
  );
}
