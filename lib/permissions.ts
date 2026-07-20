// lib/permissions.ts — admin team access model (edge-safe: no DB imports).
//
// The founding admin is the "owner": full access + manages the team. Other
// admins are granted a subset of area keys. Enforced in middleware (by path)
// and reflected in the sidebar (by filtering nav).
import type { NavSection } from "./nav";

export interface AdminArea {
  key: string;
  label: string;
  path: string; // the /admin route this area gates
}

/** Assignable areas (the "team" area is owner-only and not listed here). */
export const ADMIN_AREAS: AdminArea[] = [
  { key: "affiliates", label: "Affiliates", path: "/admin/affiliates" },
  { key: "content", label: "Content", path: "/admin/content" },
  { key: "samples", label: "Samples", path: "/admin/samples" },
  { key: "messages", label: "Messages & Groups", path: "/admin/messages" },
  { key: "notifications", label: "Notification Center", path: "/admin/notifications" },
  { key: "programs", label: "Programs", path: "/admin/programs" },
  { key: "orders", label: "Affiliate Orders", path: "/admin/affiliate-orders" },
  { key: "commissions", label: "Commissions", path: "/admin/commissions" },
  { key: "payouts", label: "Payouts", path: "/admin/payouts" },
  { key: "campaigns", label: "Campaigns", path: "/admin/campaigns" },
  { key: "codes", label: "Discount Codes", path: "/admin/codes" },
  { key: "promotions", label: "Promotions", path: "/admin/promotions" },
  { key: "settings", label: "Settings", path: "/admin/settings" },
];

export const AREA_KEYS = ADMIN_AREAS.map((a) => a.key);

export interface AdminIdentity {
  role?: string | null;
  isOwner?: boolean | null;
  permissions?: string[] | null;
}

export function isOwner(u: AdminIdentity | null | undefined): boolean {
  return !!u?.isOwner;
}

/** The set of area keys a user can reach (owner = all + team). */
export function allowedAreaKeys(u: AdminIdentity | null | undefined): string[] {
  if (u?.isOwner) return [...AREA_KEYS, "team"];
  return Array.isArray(u?.permissions) ? u!.permissions! : [];
}

export function canAccessArea(u: AdminIdentity | null | undefined, key: string): boolean {
  if (u?.role !== "admin") return false;
  if (u?.isOwner) return true;
  if (key === "team") return false; // only the owner manages the team
  return Array.isArray(u?.permissions) && u!.permissions!.includes(key);
}

/** Which area a path belongs to. null = no specific area (e.g. the dashboard). */
export function areaForPath(pathname: string): string | null {
  if (pathname === "/admin" || pathname === "/admin/") return null;
  if (pathname === "/admin/settings/team" || pathname.startsWith("/admin/settings/team/")) return "team";
  const match = [...ADMIN_AREAS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((a) => pathname === a.path || pathname.startsWith(a.path + "/"));
  return match?.key ?? null;
}

/** Can this identity open the given admin path? */
export function canAccessPath(u: AdminIdentity | null | undefined, pathname: string): boolean {
  if (u?.role !== "admin") return false;
  if (u?.isOwner) return true;
  const area = areaForPath(pathname);
  if (!area) return true; // dashboard / uncategorised admin roots
  return canAccessArea(u, area);
}

/** Filter the admin sidebar to only the areas this identity can reach. */
export function filterAdminNav(sections: NavSection[], u: AdminIdentity | null | undefined): NavSection[] {
  if (u?.isOwner) return sections;
  return sections
    .map((sec) => ({
      ...sec,
      items: sec.items
        .map((item) => {
          const children = item.children?.filter((c) => canAccessPath(u, c.href));
          const area = areaForPath(item.href);
          const selfOk = !area || canAccessArea(u, area);
          // Keep a parent if it (or any child) is reachable.
          if (!selfOk && !(children && children.length)) return null;
          return children ? { ...item, children } : item;
        })
        .filter(Boolean) as NavSection["items"],
    }))
    .filter((sec) => sec.items.length > 0);
}
