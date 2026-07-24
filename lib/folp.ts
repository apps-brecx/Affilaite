// lib/folp.ts — Friend-Offer Landing Page ("My Sipfluence Page") theme model.
//
// A block-ish theme: 8 distinct layouts, global styles/typography, shared content
// (headline/description/coupon/button/badge…), plus three repeater lists
// (products / testimonials / quiz answers) that specific layouts render. An
// affiliate customizes on top of a brand default; the brand default lists locked
// fields the affiliate can't override. The public page and the editor preview
// render from the SAME merged theme so they never drift.

export type FolpLayout =
  | "single" | "banner" | "split" | "grid" | "testimonials" | "story" | "video" | "quiz";

export const FOLP_LAYOUTS: { value: FolpLayout; label: string; desc: string }[] = [
  { value: "single", label: "Single Column", desc: "Clean, classic: logo, headline, coupon, button" },
  { value: "banner", label: "Banner Hero", desc: "Full-width hero banner + recommended-by badge" },
  { value: "split", label: "Split Hero", desc: "Image on one side, offer on the other" },
  { value: "grid", label: "Product Grid", desc: "Show off a grid of your favorite products" },
  { value: "testimonials", label: "Testimonial Stack", desc: "Reviews-first, social proof" },
  { value: "story", label: "Story Card", desc: "Full-bleed, Instagram-story style" },
  { value: "video", label: "Video Embed", desc: "Lead with a YouTube / Vimeo video" },
  { value: "quiz", label: "Quiz Result", desc: "Question → personalized product match" },
];

export const FOLP_FONTS: { value: string; label: string; stack: string }[] = [
  { value: "sans", label: "Modern Sans", stack: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { value: "display", label: "Display", stack: "'Playfair Display', Georgia, serif" },
  { value: "serif", label: "Elegant Serif", stack: "Georgia, 'Times New Roman', serif" },
  { value: "rounded", label: "Friendly Rounded", stack: "'Quicksand', 'Trebuchet MS', sans-serif" },
  { value: "mono", label: "Mono", stack: "ui-monospace, 'SF Mono', Menlo, monospace" },
];
export const fontStack = (v: string) => FOLP_FONTS.find((f) => f.value === v)?.stack ?? FOLP_FONTS[0].stack;

export interface FolpStyles {
  primaryColor: string; headingColor: string; textColor: string;
  backgroundColor: string; accentColor: string; cardColor: string;
  headingFont: string; bodyFont: string;
  cardRadius: number;      // px, 0–28
  overlayOpacity: number;  // %, 0–90 (banner/story image overlays)
}
export interface FolpProduct { image: string; name: string; price: string; salePrice: string }
export interface FolpTestimonial { quote: string; name: string; avatar: string }
export interface FolpQuizAnswer { label: string; resultTitle: string; resultDesc: string; image: string }

export interface FolpContent {
  badge: string; headline: string; subheadline: string; description: string;
  shopLabel: string; couponLabel: string; footerText: string;
  heroImageUrl: string; bannerImageUrl: string; videoUrl: string;
  quizQuestion: string; quizResultLabel: string;
  products: FolpProduct[];
  testimonials: FolpTestimonial[];
  quizAnswers: FolpQuizAnswer[];
}
export interface FolpVisibility {
  showLogo: boolean; showBadge: boolean; showCoupon: boolean;
  showSocials: boolean; showTerms: boolean; showHero: boolean;
}
export interface FolpTheme {
  layout: FolpLayout;
  styles: FolpStyles;
  content: FolpContent;
  visibility: FolpVisibility;
}
export interface FolpDefault extends FolpTheme { lockedFields: string[] }

type Kind = "color" | "text" | "textarea" | "url" | "image" | "bool" | "font" | "layout" | "number" | "products" | "testimonials" | "quiz";
interface FieldDef { path: string; label: string; group: string; kind: Kind; layouts?: FolpLayout[] }

/** Every editable field: its kind (drives sanitize + editor control) and, when
 * layout-specific, which layouts it appears on. */
export const FOLP_FIELDS: FieldDef[] = [
  { path: "layout", label: "Layout", group: "Layout", kind: "layout" },
  { path: "visibility.showLogo", label: "Show brand logo", group: "Header", kind: "bool" },
  // colors + typography (global, all layouts)
  { path: "styles.primaryColor", label: "Primary", group: "Colors", kind: "color" },
  { path: "styles.headingColor", label: "Heading", group: "Colors", kind: "color" },
  { path: "styles.textColor", label: "Text", group: "Colors", kind: "color" },
  { path: "styles.backgroundColor", label: "Background", group: "Colors", kind: "color" },
  { path: "styles.accentColor", label: "Accent", group: "Colors", kind: "color" },
  { path: "styles.cardColor", label: "Card", group: "Colors", kind: "color" },
  { path: "styles.cardRadius", label: "Corner radius", group: "Colors", kind: "number" },
  { path: "styles.overlayOpacity", label: "Image overlay", group: "Colors", kind: "number", layouts: ["banner", "story"] },
  { path: "styles.headingFont", label: "Heading font", group: "Typography", kind: "font" },
  { path: "styles.bodyFont", label: "Body font", group: "Typography", kind: "font" },
  // content
  { path: "content.badge", label: "Badge (e.g. Recommended by {{first_name}})", group: "Content", kind: "text", layouts: ["banner", "split", "story", "video"] },
  { path: "content.headline", label: "Headline", group: "Content", kind: "text" },
  { path: "content.subheadline", label: "Subheadline", group: "Content", kind: "text", layouts: ["split", "video"] },
  { path: "content.description", label: "Description", group: "Content", kind: "textarea" },
  { path: "content.shopLabel", label: "Shop button label", group: "Content", kind: "text" },
  { path: "content.couponLabel", label: "Coupon label", group: "Content", kind: "text" },
  { path: "content.footerText", label: "Footer text", group: "Content", kind: "text" },
  { path: "content.heroImageUrl", label: "Hero image", group: "Media", kind: "image", layouts: ["single", "split", "story"] },
  { path: "content.bannerImageUrl", label: "Banner image", group: "Media", kind: "image", layouts: ["banner"] },
  { path: "content.videoUrl", label: "YouTube / Vimeo URL", group: "Media", kind: "url", layouts: ["video"] },
  { path: "content.products", label: "Products", group: "Products", kind: "products", layouts: ["grid"] },
  { path: "content.testimonials", label: "Testimonials", group: "Testimonials", kind: "testimonials", layouts: ["testimonials"] },
  { path: "content.quizQuestion", label: "Quiz question", group: "Quiz", kind: "text", layouts: ["quiz"] },
  { path: "content.quizResultLabel", label: "Result label", group: "Quiz", kind: "text", layouts: ["quiz"] },
  { path: "content.quizAnswers", label: "Answers", group: "Quiz", kind: "quiz", layouts: ["quiz"] },
  // visibility
  { path: "visibility.showBadge", label: "Show badge", group: "Show / hide", kind: "bool", layouts: ["banner", "split", "story", "video"] },
  { path: "visibility.showHero", label: "Show hero/banner image", group: "Show / hide", kind: "bool", layouts: ["single", "banner", "split", "story"] },
  { path: "visibility.showCoupon", label: "Show coupon", group: "Show / hide", kind: "bool" },
  { path: "visibility.showSocials", label: "Show social links", group: "Show / hide", kind: "bool" },
  { path: "visibility.showTerms", label: "Show terms/expiry", group: "Show / hide", kind: "bool" },
];

export const REPEATER_MAX = { products: 12, testimonials: 10, quizAnswers: 6 } as const;

export function defaultFolp(): FolpDefault {
  return {
    layout: "single",
    styles: {
      primaryColor: "#FF5C9E", headingColor: "#431431", textColor: "#4b4453",
      backgroundColor: "#FFF7F1", accentColor: "#FFC94D", cardColor: "#ffffff",
      headingFont: "display", bodyFont: "sans", cardRadius: 18, overlayOpacity: 35,
    },
    content: {
      badge: "Recommended by {{first_name}}",
      headline: "Shop my Syruvia favorites",
      subheadline: "The picks I actually drink",
      description: "Use my code at checkout for a treat — these are the ones I reach for.",
      shopLabel: "Shop my favorites", couponLabel: "Save with my code",
      footerText: "Powered by Sipfluence",
      heroImageUrl: "", bannerImageUrl: "", videoUrl: "",
      quizQuestion: "What's your vibe?", quizResultLabel: "Your match",
      products: [
        { image: "", name: "Berry Boba Syrup", price: "$18", salePrice: "" },
        { image: "", name: "Brown Sugar Syrup", price: "$16", salePrice: "" },
        { image: "", name: "Matcha Blend", price: "$22", salePrice: "" },
        { image: "", name: "Taro Powder", price: "$14", salePrice: "" },
      ],
      testimonials: [
        { quote: "Genuinely the best boba I've made at home.", name: "Sam R.", avatar: "" },
        { quote: "The berry syrup is unreal. Ordered twice already.", name: "Priya K.", avatar: "" },
      ],
      quizAnswers: [
        { label: "Fruity & fresh", resultTitle: "Berry Boba Kit", resultDesc: "Bright, sweet, refreshing.", image: "" },
        { label: "Rich & cozy", resultTitle: "Brown Sugar Kit", resultDesc: "Warm, caramel, classic.", image: "" },
      ],
    },
    visibility: { showLogo: true, showBadge: true, showCoupon: true, showSocials: true, showTerms: false, showHero: true },
    lockedFields: ["visibility.showLogo"],
  };
}

// ---- path get/set ----
function getPath(o: any, p: string): any { return p.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o); }
function setPath(o: any, p: string, v: any) {
  const keys = p.split("."); let cur = o;
  for (let i = 0; i < keys.length - 1; i++) { cur[keys[i]] = cur[keys[i]] ?? {}; cur = cur[keys[i]]; }
  cur[keys[keys.length - 1]] = v;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const cap = (s: any, n: number) => (typeof s === "string" ? s.slice(0, n) : "");
const num = (v: any, min: number, max: number, fb: number) => {
  const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fb;
};

const IMG = 1_400_000; // allow inline data: URLs
function cleanProducts(arr: any): FolpProduct[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, REPEATER_MAX.products).map((p) => ({
    image: cap(p?.image, IMG), name: cap(p?.name, 120), price: cap(p?.price, 20), salePrice: cap(p?.salePrice, 20),
  }));
}
function cleanTestimonials(arr: any): FolpTestimonial[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, REPEATER_MAX.testimonials).map((t) => ({
    quote: cap(t?.quote, 300), name: cap(t?.name, 80), avatar: cap(t?.avatar, IMG),
  }));
}
function cleanQuiz(arr: any): FolpQuizAnswer[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, REPEATER_MAX.quizAnswers).map((a) => ({
    label: cap(a?.label, 80), resultTitle: cap(a?.resultTitle, 120), resultDesc: cap(a?.resultDesc, 240), image: cap(a?.image, IMG),
  }));
}

/** Sanitize submitted overrides against the brand default. Locked fields are dropped;
 * every field is type/format-checked; text is length-capped (rendered escaped later). */
export function sanitizeOverrides(input: any, brand: FolpDefault): Partial<FolpTheme> {
  const out: any = {};
  const locked = new Set(brand.lockedFields ?? []);
  for (const f of FOLP_FIELDS) {
    if (locked.has(f.path)) continue;
    const v = getPath(input, f.path);
    if (v === undefined || v === null) continue;
    switch (f.kind) {
      case "color": if (typeof v === "string" && HEX.test(v)) setPath(out, f.path, v); break;
      case "bool": setPath(out, f.path, !!v); break;
      case "layout": if (FOLP_LAYOUTS.some((l) => l.value === v)) setPath(out, f.path, v); break;
      case "font": if (FOLP_FONTS.some((x) => x.value === v)) setPath(out, f.path, v); break;
      case "number": setPath(out, f.path, num(v, 0, f.path.endsWith("overlayOpacity") ? 90 : 28, 0)); break;
      case "textarea": setPath(out, f.path, cap(v, 600)); break;
      case "url": setPath(out, f.path, cap(v, 500)); break;
      // Images may be inline data: URLs (browser-compressed), so allow long values.
      case "image": setPath(out, f.path, cap(v, 1_400_000)); break;
      case "text": setPath(out, f.path, cap(v, 200)); break;
      case "products": setPath(out, f.path, cleanProducts(v)); break;
      case "testimonials": setPath(out, f.path, cleanTestimonials(v)); break;
      case "quiz": setPath(out, f.path, cleanQuiz(v)); break;
    }
  }
  return out;
}

/** Merge affiliate overrides on top of the brand default; locked fields keep the brand value. */
export function mergeFolp(brand: FolpDefault, overrides: any): FolpTheme {
  const locked = new Set(brand.lockedFields ?? []);
  const merged: FolpDefault = JSON.parse(JSON.stringify(brand));
  if (overrides && typeof overrides === "object") {
    for (const f of FOLP_FIELDS) {
      if (locked.has(f.path)) continue;
      const v = getPath(overrides, f.path);
      if (v !== undefined && v !== null) setPath(merged, f.path, v);
    }
  }
  const { lockedFields, ...theme } = merged;
  return theme;
}

export const isLocked = (brand: FolpDefault, path: string) => (brand.lockedFields ?? []).includes(path);

// ---- Safe merge-field rendering (whitelist only, no HTML/script) ----
export interface MergeVars { first_name: string; last_name: string; shop_name: string; code: string; offer: string; expiry_date: string }
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Escape all HTML, then substitute ONLY whitelisted {{var}} tokens; strip Liquid tags. */
export function renderMerge(text: string, vars: Partial<MergeVars>): string {
  const safe = escapeHtml(text ?? "");
  return safe
    .replace(/\{%[^]*?%\}/g, "")
    .replace(/\{\{\s*(\w+(?:\.\w+)?)\s*\}\}/g, (_, key) => {
      const k = String(key).split(".").pop()!;
      return k in vars ? escapeHtml(String((vars as any)[k] ?? "")) : "";
    });
}

export const MERGE_TOKENS: { token: string; label: string }[] = [
  { token: "{{first_name}}", label: "Your first name" },
  { token: "{{shop_name}}", label: "Shop name" },
  { token: "{{code}}", label: "Your discount code" },
  { token: "{{offer}}", label: "The offer" },
];

/** Parse a YouTube/Vimeo URL to a safe embed src. Returns null for any other host. */
export function videoEmbed(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const h = u.hostname.replace(/^www\./, "").toLowerCase();
    if (h === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1).replace(/[^\w-]/g, "")}`;
    if (h === "youtube.com" || h === "m.youtube.com") {
      const id = (u.searchParams.get("v") ?? "").replace(/[^\w-]/g, "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (h === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0]?.replace(/\D/g, "");
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {}
  return null;
}
