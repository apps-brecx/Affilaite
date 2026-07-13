"use client";

import { useEffect, useRef, useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/utils";

export function CountUp({
  value,
  format = "number",
  duration = 900,
  className,
  prefix = "",
  suffix = "",
  decimals,
}: {
  value: number;
  format?: "number" | "currency" | "raw";
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setDisplay(value * eased);
            if (t < 1) requestAnimationFrame(tick);
            else setDisplay(value);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [value, duration]);

  const text =
    format === "currency"
      ? formatCurrency(display)
      : format === "raw"
        ? display.toFixed(decimals ?? 0)
        : formatNumber(Math.round(display));

  return (
    <span ref={ref} className={className}>
      {prefix}
      {text}
      {suffix}
    </span>
  );
}
