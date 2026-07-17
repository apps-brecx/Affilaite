"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Ctx = { openId: string | null; setOpenId: (id: string | null) => void };
const RevealCtx = createContext<Ctx | null>(null);

/**
 * Wrap a set of CreateReveal buttons so only one opens at a time and clicking
 * outside the group closes whatever's open.
 */
export function RevealGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openId) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenId(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openId]);
  return (
    <RevealCtx.Provider value={{ openId, setOpenId }}>
      <div ref={ref} className={className}>{children}</div>
    </RevealCtx.Provider>
  );
}

/**
 * Collapses a create form behind a button. Inside a RevealGroup it participates
 * in the accordion (one open at a time, click-away closes); standalone it just
 * toggles its own state.
 */
export function CreateReveal({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const ctx = useContext(RevealCtx);
  const id = useId();
  const [localOpen, setLocalOpen] = useState(defaultOpen);
  const open = ctx ? ctx.openId === id : localOpen;
  const setOpen = (v: boolean) => (ctx ? ctx.setOpenId(v ? id : null) : setLocalOpen(v));

  // Honor defaultOpen when part of a group.
  useEffect(() => {
    if (ctx && defaultOpen) ctx.setOpenId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
    );
  }
  return (
    <div className="w-full">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="size-4" /> Close
        </Button>
      </div>
      {children}
    </div>
  );
}
