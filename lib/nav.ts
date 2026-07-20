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
  | "campaigns"
  | "samples"
  | "general"
  | "integrations"
  | "payments"
  | "brand"
  | "invites"
  | "account"
  | "notifications";

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  children?: { label: string; href: string; icon: IconName }[];
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const affiliateNav: NavSection[] = [
  { items: [{ label: "Dashboard", href: "/dashboard", icon: "dashboard" }] },
  {
    title: "Earn",
    items: [
      { label: "Links & Codes", href: "/links", icon: "links" },
      { label: "Promotions", href: "/promotions", icon: "promotions" },
      { label: "Performance", href: "/performance", icon: "performance" },
      { label: "Leaderboard", href: "/leaderboard", icon: "campaigns" },
      { label: "Payouts", href: "/payouts", icon: "payouts" },
    ],
  },
  {
    title: "Resources",
    items: [
      { label: "My Posts", href: "/posts", icon: "campaigns" },
      { label: "My Orders", href: "/orders", icon: "performance" },
      { label: "VIP", href: "/vip", icon: "promotions" },
      { label: "Samples", href: "/samples", icon: "samples" },
      { label: "Assets", href: "/assets", icon: "assets" },
      { label: "Community", href: "/community", icon: "groups" },
      { label: "Notifications", href: "/notifications", icon: "notifications" },
    ],
  },
  { items: [{ label: "Settings", href: "/settings", icon: "settings" }] },
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
      { label: "Content", href: "/admin/content", icon: "campaigns" },
      { label: "Samples", href: "/admin/samples", icon: "samples" },
      { label: "Messages & Groups", href: "/admin/messages", icon: "messages" },
      { label: "Notification Center", href: "/admin/notifications", icon: "notifications" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Programs", href: "/admin/programs", icon: "programs" },
      { label: "Affiliate Orders", href: "/admin/affiliate-orders", icon: "performance" },
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
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        icon: "settings",
        children: [
          { label: "General", href: "/admin/settings", icon: "general" },
          { label: "Team & access", href: "/admin/settings/team", icon: "affiliates" },
          { label: "Integrations", href: "/admin/settings/integrations", icon: "integrations" },
          { label: "Payments", href: "/admin/settings/payments", icon: "payments" },
          { label: "Brand & theme", href: "/admin/settings/brand", icon: "brand" },
          { label: "Invite templates", href: "/admin/settings/invites", icon: "invites" },
          { label: "Account", href: "/admin/settings/account", icon: "account" },
        ],
      },
    ],
  },
];
