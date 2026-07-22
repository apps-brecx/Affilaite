"use client";

import { Instagram, Globe, Youtube, Music2, Twitter, Facebook, ArrowRight, Ticket } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { fontStack, renderMerge, type FolpTheme, type MergeVars } from "@/lib/folp";

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram, website: Globe, youtube: Youtube, tiktok: Music2, x: Twitter, twitter: Twitter, facebook: Facebook,
};

/**
 * Renders a friend-offer landing page from a merged theme. Shared by the editor's
 * live preview and the public /p/[handle] page so they always match. The brand
 * logo sits centered at the very top.
 */
export function FolpView({
  theme,
  logoText,
  name,
  code,
  shopLink,
  socials,
  vars,
  device = "desktop",
}: {
  theme: FolpTheme;
  logoText: string;
  name: string;
  code: string;
  shopLink: string;
  socials: Record<string, string>;
  vars: MergeVars;
  device?: "desktop" | "mobile";
}) {
  const s = theme.styles;
  const card = theme.layout === "minimal" ? "transparent" : s.cardColor;
  const socialEntries = Object.entries(socials).filter(([, v]) => v && v.trim());
  const heading = { color: s.headingColor, fontFamily: fontStack(s.headingFont) };
  const body = { color: s.textColor, fontFamily: fontStack(s.bodyFont) };

  return (
    <div
      style={{ background: s.backgroundColor, fontFamily: fontStack(s.bodyFont) }}
      className="mx-auto flex min-h-full w-full flex-col items-center px-5 py-10"
    >
      <div className={`w-full ${device === "mobile" ? "max-w-[360px]" : "max-w-md"}`}>
        {/* Brand logo — always centered on top */}
        {theme.visibility.showLogo && (
          <p className="mb-6 text-center text-lg font-extrabold tracking-tight" style={{ color: s.primaryColor }}>
            {logoText || "Sipfluence"}
          </p>
        )}

        {/* Spotlight hero */}
        {theme.layout === "spotlight" && theme.visibility.showHero && theme.content.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.content.heroImageUrl} alt="" className="mb-5 h-40 w-full rounded-2xl object-cover" />
        )}

        <div
          className={theme.layout === "cards" ? "rounded-3xl p-6 shadow-sm" : ""}
          style={theme.layout === "cards" ? { background: card } : undefined}
        >
          <h1
            className="text-center text-2xl font-bold leading-tight"
            style={heading}
            dangerouslySetInnerHTML={{ __html: renderMerge(theme.content.headline, vars) }}
          />
          {theme.content.description && (
            <p
              className="mx-auto mt-2 max-w-sm text-center text-sm"
              style={body}
              dangerouslySetInnerHTML={{ __html: renderMerge(theme.content.description, vars) }}
            />
          )}

          {theme.layout !== "spotlight" && theme.visibility.showHero && theme.content.heroImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.content.heroImageUrl} alt="" className="mt-5 h-40 w-full rounded-2xl object-cover" />
          )}

          {/* Shop CTA */}
          <a
            href={shopLink}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 font-semibold shadow-sm transition-transform hover:scale-[1.02]"
            style={{ background: s.primaryColor, color: "#ffffff" }}
          >
            {theme.content.shopLabel || "Shop my favorites"} <ArrowRight className="size-4" />
          </a>

          {/* Coupon */}
          {theme.visibility.showCoupon && (
            <div
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl px-5 py-4"
              style={{ border: `1px dashed ${s.primaryColor}66`, background: theme.layout === "minimal" ? "transparent" : `${s.primaryColor}0f` }}
            >
              <div>
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: s.textColor }}>
                  <Ticket className="size-3.5" style={{ color: s.accentColor }} /> {theme.content.couponLabel || "Save with my code"}
                </p>
                <p className="text-xl font-bold tracking-wide" style={{ color: s.primaryColor }}>{code}</p>
              </div>
              <CopyButton value={code} />
            </div>
          )}

          {theme.visibility.showTerms && (
            <p className="mt-3 text-center text-[11px]" style={{ color: s.textColor, opacity: 0.7 }}>
              Discount applies at checkout. Terms may apply.
            </p>
          )}
        </div>

        {/* Socials */}
        {theme.visibility.showSocials && socialEntries.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {socialEntries.map(([key, url]) => {
              const Icon = SOCIAL_ICONS[key.toLowerCase()] ?? Globe;
              const href = url.startsWith("http") ? url : key.toLowerCase() === "instagram" ? `https://instagram.com/${url.replace(/^@/, "")}` : `https://${url}`;
              return (
                <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={key}
                  className="flex size-11 items-center justify-center rounded-full"
                  style={{ background: card === "transparent" ? "#00000010" : card, color: s.textColor, border: `1px solid ${s.primaryColor}22` }}>
                  <Icon className="size-5" />
                </a>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-[11px]" style={{ color: s.textColor, opacity: 0.6 }}>
          {theme.content.footerText || "Powered by Sipfluence"}
        </p>
      </div>
    </div>
  );
}
