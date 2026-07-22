"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { suggestAddresses } from "@/app/actions/address";
import type { AddressSuggestion } from "@/lib/geocode";

/**
 * Street-address input with a type-ahead suggestion dropdown. As the user types,
 * it queries the geocoder and lists matches; selecting one calls onSelect with
 * the full structured address so the parent can auto-fill city / state / ZIP /
 * country. Degrades to a plain text input when the geocoder returns nothing.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  name,
  placeholder = "Start typing your address…",
  className,
  autoComplete = "off",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (a: AddressSuggestion) => void;
  name?: string;
  placeholder?: string;
  className?: string;
  autoComplete?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const justSelected = useRef(false);
  const seq = useRef(0);
  const listId = useId();

  // Debounced lookup. Skips the fetch right after a selection so picking an item
  // doesn't immediately re-open the list.
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const res = await suggestAddresses(q);
        if (mine !== seq.current) return; // a newer keystroke superseded this one
        setItems(res);
        setOpen(res.length > 0);
        setActive(-1);
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  // Close when clicking outside.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (a: AddressSuggestion) => {
    justSelected.current = true;
    onSelect(a);
    setOpen(false);
    setItems([]);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + items.length) % items.length);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`pl-9 ${className ?? ""}`}
          autoComplete={autoComplete}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {loading && <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-hairline bg-popover p-1 shadow-lg"
        >
          {items.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(a)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  i === active ? "bg-muted" : "hover:bg-muted/60"
                }`}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium">{a.line1 || a.city}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[a.city, a.region, a.postalCode, a.country].filter(Boolean).join(", ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
