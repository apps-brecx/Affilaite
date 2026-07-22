// lib/folp.ts — Friend-Offer Landing Page ("My Sipfluence Page") theme model.
//
// An affiliate customizes their OWN version on top of a brand default. The brand
// default also lists lockedFields — paths the affiliate can't override (they
// always fall back to the brand value). The public page and the editor preview
// both render from the SAME merged theme so what they see is what ships.

export type FolpLayout = "classic" | "spotlight" | "minimal" | "cards";

export const FOLP_LAYOUTS: { value: FolpLayout; label: string; desc: string }[] = [
  { value: "classic", label: "Classic", desc: "Avatar, bio, big shop button, code" },
  { value: "spotlight", label: "Spotlight", desc: "Full-width hero image up top" },
  { value: "minimal", label: "Minimal", desc: "Clean, text-first, no card chrome" },
  { value: "cards", label: "Cards", desc: "Everything in soft rounded cards" },
];

// Curated font stacks — affiliates pick from these, never upload arbitrary fonts.
export const FOLP_FONTS: { value: string; label: string; stack: string }[] = [
  { value: "sans", label: "Modern Sans", stack: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { value: "display", label: "Display", stack: "'Playfair Display', Georgia, serif" },
  { value: "serif", label: "Elegant Serif", stack: "Georgia, 'Times New Roman', serif" },
  { value: "rounded", label: "Friendly Rounded", stack: "'Quicksand', 'Trebuchet MS', sans-serif" },
  { value: "mono", label: "Mono", stack: "ui-monospace, 'SF Mono', Menlo, monospace" },
];
export const fontStack = (v: string) => FOLP_FONTS.find((f) => f.value === v)?.stack ?? FOLP_FONTS[0].stack;

export interface FolpStyles {
  primaryColor: string;
  headingColor: string;
  textColor: string;
  backgroundColor: string;
  accentColor: string;
  cardColor: string;
  headingFont: string;
  bodyFont: string;
}
export interface FolpContent {
  headline: string;
  description: string;
  shopLabel: string;
  couponLabel: string;
  footerText: string;
  heroImageUrl: string;
}
export interface FolpVisibility {
  showLogo: boolean;
  showCoupon: boolean;
  showSocials: boolean;
  showTerms: boolean;
  showHero: boolean;
}
export interface FolpTheme {
  layout: FolpLayout;
  styles: FolpStyles;
  content: FolpContent;
  visibility: FolpVisibility;
}
/** The brand-level default carries the lock list on top of a normal theme. */
export interface FolpDefault extends FolpTheme {
  lockedFields: string[];
}

/** Every field path the editor exposes (used for lock toggles + merge). */
export const FOLP_FIELDS: { path: string; label: string; group: string }[] = [
  { path: "visibility.showLogo", label: "Show brand logo", group: "Header" },
  { path: "layout", label: "Layout", group: "Layout" },
  { path: "styles.primaryColor", label: "Primary color", group: "Colors" },
  { path: "styles.headingColor", label: "Heading color", group: "Colors" },
  { path: "styles.textColor", label: "Text color", group: "Colors" },
  { path: "styles.backgroundColor", label: "Background color", group: "Colors" },
  { path: "styles.accentColor", label: "Accent color", group: "Colors" },
  { path: "styles.cardColor", label: "Card color", group: "Colors" },
  { path: "styles.headingFont", label: "Heading font", group: "Typography" },
  { path: "styles.bodyFont", label: "Body font", group: "Typography" },
  { path: "content.headline", label: "Headline", group: "Content" },
  { path: "content.description", label: "Description", group: "Content" },
  { path: "content.shopLabel", label: "Shop button label", group: "Content" },
  { path: "content.couponLabel", label: "Coupon label", group: "Content" },
  { path: "content.heroImageUrl", label: "Hero image", group: "Content" },
  { path: "content.footerText", label: "Footer text", group: "Content" },
  { path: "visibility.showCoupon", label: "Show coupon", group: "Content" },
  { path: "visibility.showSocials", label: "Show social links", group: "Content" },
  { path: "visibility.showHero", label: "Show hero image", group: "Content" },
  { path: "visibility.showTerms", label: "Show terms/expiry", group: "Content" },
];

export function defaultFolp(): FolpDefault {
  return {
    layout: "classic",
    styles: {
      primaryColor: "#FF5C9E",
      headingColor: "#431431",
      textColor: "#4b4453",
      backgroundColor: "#FFF7F1",
      accentColor: "#FFC94D",
      cardColor: "#ffffff",
      headingFont: "display",
      bodyFont: "sans",
    },
    content: {
      headline: "Shop my Syruvia favorites",
      description: "Use my code at checkout for a treat — these are the picks I actually drink.",
      shopLabel: "Shop my favorites",
      couponLabel: "Save with my code",
      footerText: "Powered by Sipfluence",
      heroImageUrl: "",
    },
    visibility: { showLogo: true, showCoupon: true, showSocials: true, showTerms: false, showHero: false },
    // The brand logo stays on by default; admins can lock it so affiliates can't
    // hide or replace it. Nothing else is locked out of the box.
    lockedFields: ["visibility.showLogo"],
  };
}

// ---- path get/set helpers (dot notation over the theme object) ----
function getPath(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj: any, path: string, value: any) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    o[keys[i]] = o[keys[i]] ?? {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Server-side sanitize of submitted overrides: type/format-check every field,
 * and NEVER keep a value for a locked field (those always use the brand default). */
export function sanitizeOverrides(input: any, brand: FolpDefault): Partial<FolpTheme> {
  const out: any = {};
  const locked = new Set(brand.lockedFields ?? []);
  for (const { path } of FOLP_FIELDS) {
    if (locked.has(path)) continue; // locked fields can't be overridden
    const v = getPath(input, path);
    if (v === undefined || v === null) continue;
    const def = getPath(brand, path);
    // Type-check each field against the default's type; validate hex colors.
    if (path.includes("Color")) {
      if (typeof v === "string" && HEX.test(v)) setPath(out, path, v);
    } else if (typeof def === "boolean") {
      setPath(out, path, !!v);
    } else if (path === "layout") {
      if (FOLP_LAYOUTS.some((l) => l.value === v)) setPath(out, path, v);
    } else if (path.endsWith("Font")) {
      if (FOLP_FONTS.some((f) => f.value === v)) setPath(out, path, v);
    } else if (typeof def === "string") {
      // Text/URL: cap length, keep as plain text (rendered escaped later).
      if (typeof v === "string") setPath(out, path, v.slice(0, path === "content.description" ? 600 : 200));
    }
  }
  return out;
}

/** Merge affiliate overrides on top of the brand default; locked fields win for the brand. */
export function mergeFolp(brand: FolpDefault, overrides: any): FolpTheme {
  const locked = new Set(brand.lockedFields ?? []);
  const merged: FolpDefault = JSON.parse(JSON.stringify(brand));
  if (overrides && typeof overrides === "object") {
    for (const { path } of FOLP_FIELDS) {
      if (locked.has(path)) continue; // locked → keep brand value
      const v = getPath(overrides, path);
      if (v !== undefined && v !== null) setPath(merged, path, v);
    }
  }
  const { lockedFields, ...theme } = merged;
  return theme;
}

export const isLocked = (brand: FolpDefault, path: string) => (brand.lockedFields ?? []).includes(path);

// ---- Safe merge-field rendering (whitelist only, no HTML/script) ----
export interface MergeVars {
  first_name: string;
  shop_name: string;
  code: string;
  offer: string;
}
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Render affiliate text: escape all HTML, then substitute ONLY the whitelisted
 * {{ var }} tokens. Any {% ... %} / unknown {{ ... }} is stripped, so no Liquid
 * or script injection is possible from affiliate input.
 */
export function renderMerge(text: string, vars: MergeVars): string {
  const safe = escapeHtml(text ?? "");
  return safe
    .replace(/\{%[^]*?%\}/g, "") // strip liquid tags entirely
    .replace(/\{\{\s*(\w+(?:\.\w+)?)\s*\}\}/g, (_, key) => {
      const k = String(key).split(".").pop()!;
      return k in vars ? escapeHtml(String((vars as any)[k] ?? "")) : "";
    });
}

export const MERGE_TOKENS: { token: string; label: string }[] = [
  { token: "{{first_name}}", label: "Your first name" },
  { token: "{{shop_name}}", label: "Shop name" },
  { token: "{{code}}", label: "Your discount code" },
  { token: "{{offer}}", label: "The offer (e.g. 10% off)" },
];
