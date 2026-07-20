"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A labelled button that reveals its (server-rendered) children when clicked.
 * Lets us tuck things like request history behind a tap without a full modal.
 */
export function RevealSection({
  label,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  label: string;
  icon?: ReactNode;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <Button variant={open ? "secondary" : "outline"} onClick={() => setOpen((o) => !o)}>
        {icon}
        {label}
        {typeof count === "number" && count > 0 && (
          <span className="ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold text-primary">
            {count}
          </span>
        )}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </Button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
