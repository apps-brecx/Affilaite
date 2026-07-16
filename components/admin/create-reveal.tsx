"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Collapses a create form behind a button. The form (children) only shows once
 * the admin clicks "New …", keeping list pages uncluttered.
 */
export function CreateReveal({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          <X className="size-4" /> Close
        </Button>
      </div>
      {children}
    </div>
  );
}
