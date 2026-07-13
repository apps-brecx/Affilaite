"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  defaultChecked = false,
  label,
  description,
}: {
  defaultChecked?: boolean;
  label?: string;
  description?: string;
}) {
  const [on, setOn] = useState(defaultChecked);
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      {(label || description) && (
        <span className="space-y-0.5">
          {label && <span className="block text-sm font-medium text-foreground">{label}</span>}
          {description && <span className="block text-xs text-muted-foreground">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "inline-block size-5 transform rounded-full bg-white shadow-subtle transition-transform",
            on ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}
