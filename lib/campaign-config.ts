// Rich, structured campaign configuration (stored as JSONB on campaigns.config)
// and the global brand/theme settings. Kept as one evolving shape so we can add
// options without a migration each time.

export type RewardKind = "coupon" | "cash" | "credit" | "custom";
export type ValueType = "percent" | "fixed";

export interface CampaignConfig {
  reward: {
    kind: RewardKind;
    valueType: ValueType; // for coupon/cash/credit
    value: number;
    custom: string; // for kind === "custom" (e.g. "Free product gift")
    bonusEnabled: boolean;
    bonusType: ValueType;
    bonusValue: number;
  };
  conditions: {
    minOrderType: "none" | "amount" | "orders";
    minOrderValue: number;
    trigger: "every" | "first" | "custom";
    triggerCustom: string;
    maxPerAdvocateEnabled: boolean;
    maxPerAdvocate: number;
  };
  coupon: {
    expires: boolean;
    combineProduct: boolean; // combines with product discounts
    combineOrder: boolean; // combines with order discounts
    combineShipping: boolean; // combines with shipping discounts
    appliesTo: "all" | "collections";
    collections: string; // comma-separated collection handles/ids
  };
  friend: {
    kind: "coupon" | "promo" | "none";
    valueType: ValueType; // coupon
    value: number; // coupon
    minOrder: number; // coupon
    promoDescription: string; // promo
    promoUrl: string; // promo
    promoExpires: boolean; // promo
  };
  payout: { mode: "automatic" | "manual" };
  // How commissions from this campaign clear: "auto" matures after the hold
  // window; "manual" requires an admin to approve each one.
  approval: { mode: "auto" | "manual" };
  // Per-campaign theme for the pages partners see (/join/<slug>). Overrides the
  // global brand. `enabled` off falls back to the global theme.
  brand?: CampaignBrand;
}

// Per-campaign theme/branding for the /join landing page.
export interface CampaignBrand {
  enabled: boolean;
  logoText: string;
  logoImage: string; // data URL (optional)
  primaryColor: string; // hex — buttons, links, highlights
  accentColor: string; // hex — gold/secondary accents
  backgroundColor: string; // hex (optional) — page background; "" = default look
  heroImage: string; // data URL (optional) — background/hero on the join page
  headline: string;
  subtext: string;
  approvedMessage: string;
}

export function defaultCampaignBrand(): CampaignBrand {
  return {
    enabled: false,
    logoText: "",
    logoImage: "",
    primaryColor: "#FF5C9E",
    accentColor: "#FFC94D",
    backgroundColor: "",
    heroImage: "",
    headline: "",
    subtext: "",
    approvedMessage: "",
  };
}

export function mergeCampaignBrand(stored: any): CampaignBrand {
  return { ...defaultCampaignBrand(), ...(stored && typeof stored === "object" ? stored : {}) };
}

export function defaultConfig(): CampaignConfig {
  return {
    reward: { kind: "coupon", valueType: "percent", value: 15, custom: "", bonusEnabled: false, bonusType: "fixed", bonusValue: 0 },
    conditions: { minOrderType: "none", minOrderValue: 0, trigger: "every", triggerCustom: "", maxPerAdvocateEnabled: false, maxPerAdvocate: 0 },
    coupon: { expires: false, combineProduct: true, combineOrder: true, combineShipping: true, appliesTo: "all", collections: "" },
    friend: { kind: "coupon", valueType: "percent", value: 10, minOrder: 0, promoDescription: "", promoUrl: "", promoExpires: false },
    payout: { mode: "manual" },
    approval: { mode: "auto" },
    brand: defaultCampaignBrand(),
  };
}

/** Merge a stored (possibly partial) config over the defaults. */
export function mergeConfig(stored: any): CampaignConfig {
  const d = defaultConfig();
  if (!stored || typeof stored !== "object") return d;
  return {
    reward: { ...d.reward, ...(stored.reward ?? {}) },
    conditions: { ...d.conditions, ...(stored.conditions ?? {}) },
    coupon: { ...d.coupon, ...(stored.coupon ?? {}) },
    friend: { ...d.friend, ...(stored.friend ?? {}) },
    payout: { ...d.payout, ...(stored.payout ?? {}) },
    approval: { ...d.approval, ...(stored.approval ?? {}) },
    brand: mergeCampaignBrand(stored.brand),
  };
}

// ---------- Brand / theme ----------

export interface BrandSettings {
  logoText: string;
  primaryColor: string; // hex
  accentColor: string; // hex (gold)
  signupHeadline: string;
  signupSubtext: string;
  approvedMessage: string;
}

export function defaultBrand(): BrandSettings {
  return {
    logoText: "Sipfluence",
    primaryColor: "#FF5C9E",
    accentColor: "#FFC94D",
    signupHeadline: "",
    signupSubtext: "",
    approvedMessage: "",
  };
}

export function mergeBrand(stored: any): BrandSettings {
  return { ...defaultBrand(), ...(stored && typeof stored === "object" ? stored : {}) };
}

/** hex (#rrggbb) → "H S% L%" for CSS custom properties used with hsl(var(--x)). */
export function hexToHslTriple(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "162 74% 22%";
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const dd = max - min;
  const s = dd === 0 ? 0 : dd / (1 - Math.abs(2 * l - 1));
  if (dd !== 0) {
    if (max === r) h = ((g - b) / dd) % 6;
    else if (max === g) h = (b - r) / dd + 2;
    else h = (r - g) / dd + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
