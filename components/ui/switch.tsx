"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function Switch({
  defaultChecked = false,
  checked,
  onCheckedChange,
  label,
  description,
}: {
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (v: boolean) => void;
  label?: string;
  description?: string;
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const on = checked ?? internal;
  const toggle = () => {
    const next = !on;
    if (checked === undefined) setInternal(next);
    onCheckedChange?.(next);
  };

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
        onClick={toggle}
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
