// Plain, serializable nav data. Icons are referenced by name and resolved to
// components inside the (client) shell — components can't cross the RSC boundary.

export type IconName =
  | "dashboard"
  | "links"
  | "performance"
  | "payouts"
  | "assets"
  | "settings"
  | "affiliates"
  | "groups"
  | "commissions"
  | "programs"
  | "codes"
  | "promotions"
  | "messages"
  | "campaigns";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const affiliateNav: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { label: "Links & Codes", href: "/links", icon: "links" },
      { label: "Performance", href: "/performance", icon: "performance" },
      { label: "Payouts", href: "/payouts", icon: "payouts" },
      { label: "Assets", href: "/assets", icon: "assets" },
      { label: "Settings", href: "/settings", icon: "settings" },
    ],
  },
];

export const adminNav: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Command Center", href: "/admin", icon: "dashboard" }],
  },
  {
    title: "People",
    items: [
      { label: "Affiliates", href: "/admin/affiliates", icon: "affiliates" },
      { label: "Groups", href: "/admin/groups", icon: "groups" },
      { label: "Messages", href: "/admin/messages", icon: "messages" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Programs", href: "/admin/programs", icon: "programs" },
      { label: "Commissions", href: "/admin/commissions", icon: "commissions" },
      { label: "Payouts", href: "/admin/payouts", icon: "payouts" },
    ],
  },
  {
    title: "Growth",
    items: [
      { label: "Campaigns", href: "/admin/campaigns", icon: "campaigns" },
      { label: "Discount Codes", href: "/admin/codes", icon: "codes" },
      { label: "Promotions", href: "/admin/promotions", icon: "promotions" },
    ],
  },
  {
    title: "System",
    items: [{ label: "Settings", href: "/admin/settings", icon: "settings" }],
  },
];
