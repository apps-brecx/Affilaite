"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  LayoutDashboard,
  Link2,
  BadgePercent,
  BarChart3,
  Wallet,
  Images,
  UsersRound,
  ArrowRight,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getMyNotifications, markAllNotificationsRead } from "@/app/actions/notifications";
import type { NotificationRow } from "@/lib/notifications";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const ICON: Record<string, typeof Bell> = {
  dashboard: LayoutDashboard,
  links: Link2,
  promotions: BadgePercent,
  performance: BarChart3,
  payouts: Wallet,
  assets: Images,
  community: UsersRound,
};

export function NotificationBell({ count, onChange }: { count: number; onChange?: () => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  // Load + poll while the panel is open.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () => getMyNotifications().then((n) => active && setItems(n)).catch(() => {});
    load();
    const id = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    await markAllNotificationsRead();
    onChange?.();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative inline-flex size-9 items-center justify-center rounded-full border border-hairline bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground ring-2 ring-background">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-hairline bg-popover shadow-lift"
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
              <p className="font-display text-sm font-bold">Notifications</p>
              {items.some((i) => !i.read) && (
                <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <CheckCheck className="size-3.5" /> Mark all read
                </button>
              )}
            </div>

            <div className="max-h-[22rem] overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
                  <Bell className="size-5" />
                  You&apos;re all caught up.
                </div>
              ) : (
                items.slice(0, 8).map((n) => {
                  const Icon = ICON[n.section] ?? Bell;
                  const body = (
                    <div className={cn("flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/50", !n.read && "bg-primary/[0.04]")}>
                      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Icon className="size-4" />
                        {!n.read && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-primary ring-2 ring-popover" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>}
                        <p className="mt-1 text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</p>
                      </div>
                    </div>
                  );
                  return n.href ? (
                    <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="block">
                      {body}
                    </Link>
                  ) : (
                    <div key={n.id}>{body}</div>
                  );
                })
              )}
            </div>

            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 border-t border-hairline px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-accent/50"
            >
              See all notifications <ArrowRight className="size-3.5" />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
