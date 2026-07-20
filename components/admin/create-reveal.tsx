"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Ctx = { openId: string | null; setOpenId: (id: string | null) => void };
const RevealCtx = createContext<Ctx | null>(null);

/**
 * Wrap a set of CreateReveal buttons so only one opens at a time (an accordion).
 * Click-away closing is handled per-reveal, so this is optional.
 */
export function RevealGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <RevealCtx.Provider value={{ openId, setOpenId }}>
      <div className={className}>{children}</div>
    </RevealCtx.Provider>
  );
}

/**
 * Collapses a create form behind a button. Closes when you click outside it, and
 * inside a RevealGroup opening one closes the others.
 */
export function CreateReveal({
  label,
  children,
  defaultOpen = false,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  /** Leading icon on the button. Defaults to a "+" (for create-new actions); pass null to hide it. */
  icon?: React.ReactNode;
}) {
  const ctx = useContext(RevealCtx);
  const id = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = ctx ? ctx.openId === id : localOpen;
  const setOpen = (v: boolean) => (ctx ? ctx.setOpenId(v ? id : null) : setLocalOpen(v));
  const ref = useRef<HTMLDivElement>(null);

  // Honor defaultOpen when part of a group.
  useEffect(() => {
    if (ctx && defaultOpen) ctx.setOpenId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click anywhere outside this reveal closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) {
    const leading = icon === undefined ? <Plus className="size-4" /> : icon;
    return (
      <Button onClick={() => setOpen(true)}>
        {leading}
        {label}
      </Button>
    );
  }
  return (
    <div ref={ref} className="w-full">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="size-4" /> Close
        </Button>
      </div>
      {children}
    </div>
  );
}
