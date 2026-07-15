"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { markNotificationsReadByPath, getMyBadges } from "@/app/actions/notifications";
import {
  Menu,
  X,
  ChevronDown,
  LifeBuoy,
  LayoutDashboard,
  Link2,
  BarChart3,
  Wallet,
  Images,
  Settings,
  Users,
  UsersRound,
  Megaphone,
  Layers,
  Receipt,
  Ticket,
  BadgePercent,
  Rocket,
  SlidersHorizontal,
  Blocks,
  CreditCard,
  Palette,
  Mail,
  UserCircle,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { NavSection, IconName } from "@/lib/nav";

const ICONS: Record<IconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  links: Link2,
  performance: BarChart3,
  payouts: Wallet,
  assets: Images,
  settings: Settings,
  affiliates: Users,
  groups: UsersRound,
  commissions: Receipt,
  programs: Layers,
  codes: Ticket,
  promotions: BadgePercent,
  messages: Megaphone,
  campaigns: Rocket,
  general: SlidersHorizontal,
  integrations: Blocks,
  payments: CreditCard,
  brand: Palette,
  invites: Mail,
  account: UserCircle,
  notifications: Bell,
};

function NavBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-semibold leading-5 text-danger-foreground">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavRow({
  item,
  onNavigate,
  badges,
}: {
  item: NavSection["items"][number];
  onNavigate?: () => void;
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  const Icon = ICONS[item.icon];
  const badge = badges?.[item.href] ?? 0;
  const hasChildren = !!item.children?.length;
  const withinParent = hasChildren && pathname.startsWith(item.href);
  const [open, setOpen] = useState(withinParent);
  useEffect(() => {
    if (withinParent) setOpen(true);
  }, [withinParent]);

  const active =
    pathname === item.href ||
    (item.href !== "/admin" && item.href !== "/dashboard" && !hasChildren && pathname.startsWith(item.href));

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            withinParent ? "text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <Icon className={cn("size-4", withinParent ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
          {item.label}
          <ChevronDown className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="mt-1 flex flex-col gap-0.5 pl-4">
            {item.children!.map((child) => {
              const childActive = pathname === child.href;
              const ChildIcon = ICONS[child.icon];
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                    childActive
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <ChildIcon className={cn("size-4", childActive ? "text-primary" : "text-muted-foreground")} />
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="nav-active"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <Icon className={cn("size-4 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      {item.label}
      {badge > 0 && <NavBadge count={badge} />}
    </Link>
  );
}

function NavLinks({
  sections,
  onNavigate,
  badges,
}: {
  sections: NavSection[];
  onNavigate?: () => void;
  badges?: Record<string, number>;
}) {
  return (
    <nav className="flex flex-col gap-6">
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-1">
          {section.title && (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavRow key={item.href} item={item} onNavigate={onNavigate} badges={badges} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function UserCard({ name, email, role }: { name: string; email: string; role: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-hairline bg-background/60 p-2.5">
      <Avatar name={name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{role}</p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        aria-label="Sign out"
        className="text-muted-foreground transition-colors hover:text-danger"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

export function AppShell({
  sections,
  user,
  variant,
  badges: initialBadges,
  children,
}: {
  sections: NavSection[];
  user: { name: string; email: string; role: string };
  variant: "affiliate" | "admin";
  badges?: Record<string, number>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number>>(initialBadges ?? {});

  // Live badge counts: poll on an interval and whenever the tab regains focus,
  // so new notifications show up without a page reload.
  useEffect(() => {
    if (variant !== "affiliate") return;
    let active = true;
    const refresh = () =>
      getMyBadges()
        .then((b) => active && setBadges(b))
        .catch(() => {});
    const id = setInterval(refresh, 12000);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [variant]);

  // Entering a section clears only that section's notifications (which also
  // brings the Notifications total down). Visiting the Notifications inbox
  // itself clears nothing — each tab keeps its dot until it's actually opened.
  useEffect(() => {
    if (variant !== "affiliate") return;
    markNotificationsReadByPath(pathname)
      .then(() => getMyBadges())
      .then((b) => setBadges(b))
      .catch(() => {});
  }, [pathname, variant]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-hairline bg-card/40 px-4 py-5 lg:flex">
        <div className="flex items-center justify-between px-1">
          <Logo />
          {variant === "admin" && (
            <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
              Admin
            </span>
          )}
        </div>
        <div className="mt-8 flex-1 overflow-y-auto no-scrollbar">
          <NavLinks sections={sections} badges={badges} />
        </div>
        <div className="mt-4 space-y-2">
          <Link
            href="#"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <LifeBuoy className="size-4" /> Support
          </Link>
          <UserCard {...user} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-hairline bg-background/80 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen(true)}
            className="inline-flex size-9 items-center justify-center rounded-md border border-hairline"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-hairline bg-card px-4 py-5 lg:hidden"
            >
              <div className="flex items-center justify-between">
                <Logo />
                <button
                  onClick={() => setOpen(false)}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-hairline"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="mt-8 flex-1 overflow-y-auto no-scrollbar">
                <NavLinks sections={sections} onNavigate={() => setOpen(false)} badges={badges} />
              </div>
              <UserCard {...user} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="lg:pl-64">
        {/* Desktop top bar */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-end gap-3 border-b border-hairline bg-background/70 px-8 backdrop-blur-lg lg:flex">
          <span className="mr-auto text-sm text-muted-foreground">
            {variant === "admin" ? "Syruvia · Admin" : "Syruvia · Partner Portal"}
          </span>
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
