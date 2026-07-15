"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label,
  className,
  variant = "icon",
}: {
  value: string;
  label?: string;
  className?: string;
  variant?: "icon" | "full" | "outline";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard unavailable */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const content = (
    <AnimatePresence mode="wait" initial={false}>
      {copied ? (
        <motion.span
          key="c"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          className="inline-flex items-center gap-2"
        >
          <Check className="size-4" /> Copied
        </motion.span>
      ) : (
        <motion.span
          key="l"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.6, opacity: 0 }}
          className="inline-flex items-center gap-2"
        >
          <Copy className="size-4" /> {label ?? "Copy"}
        </motion.span>
      )}
    </AnimatePresence>
  );

  if (variant === "full") {
    return (
      <button
        onClick={copy}
        className={cn(
          "group inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-subtle transition-all hover:bg-primary/90 active:scale-[0.98]",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  if (variant === "outline") {
    return (
      <button
        onClick={copy}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]",
          copied
            ? "border-success/40 bg-success-soft text-success"
            : "border-hairline bg-background text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <button
      onClick={copy}
      aria-label="Copy"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md border border-hairline bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="c" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
            <Check className="size-4 text-success" />
          </motion.span>
        ) : (
          <motion.span key="l" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
            <Copy className="size-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
