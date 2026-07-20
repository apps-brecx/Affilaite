"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { setDiscoveredStatus } from "@/app/actions/admin";
import { useToast } from "@/components/ui/toast";

export function DiscoveredActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const act = (status: "kept" | "dismissed") =>
    start(async () => {
      const res = await setDiscoveredStatus(id, status);
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });

  if (pending) return <Loader2 className="size-4 animate-spin text-muted-foreground" />;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => act("kept")}
        title="Keep"
        aria-label="Keep"
        className="rounded-md p-1.5 text-success transition-colors hover:bg-success-soft"
      >
        <Check className="size-4" />
      </button>
      <button
        onClick={() => act("dismissed")}
        title="Dismiss"
        aria-label="Dismiss"
        className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
