"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, UserPlus, Package, MessageSquare } from "lucide-react";
import { getAdminActivityFeed } from "@/app/actions/notifications";
import { relativeTime } from "@/lib/utils";
import type { AdminActivityItem } from "@/lib/queries";

const ICON = {
  application: UserPlus,
  sample: Package,
  message: MessageSquare,
} as const;

/** Admin notification bell — named "New application from …" items pulled live
 *  from pending applications, sample requests and unread messages. */
export function AdminBell() {
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const refresh = () => getAdminActivityFeed().then(setItems).catch(() => {});

  // Poll so new applications appear without a reload; re-check on route change.
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { refresh(); setOpen(false); }, [pathname]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = items.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count ? ` (${count})` : ""}`}
        className="relative inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-hairline bg-card shadow-lg">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            {count > 0 && <span className="text-xs text-muted-foreground">{count} to review</span>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {count === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up 🎉</p>
            ) : (
              items.map((it) => {
                const Icon = ICON[it.kind];
                return (
                  <Link
                    key={it.id}
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-b border-hairline/60 px-4 py-3 transition-colors last:border-0 hover:bg-accent"
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{it.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{it.subtitle}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(new Date(it.at))}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
