"use client";

import { useState } from "react";
import { Instagram, Globe, Youtube, Music2, Twitter, Facebook, ArrowRight, Ticket, Star, Play } from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { fontStack, renderMerge, videoEmbed, type FolpTheme, type MergeVars } from "@/lib/folp";

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram, website: Globe, youtube: Youtube, tiktok: Music2, x: Twitter, twitter: Twitter, facebook: Facebook,
};

export function FolpView({
  theme, logoText, name, code, shopLink, socials, vars, device = "desktop",
}: {
  theme: FolpTheme; logoText: string; name: string; code: string; shopLink: string;
  socials: Record<string, string>; vars: Partial<MergeVars>; device?: "desktop" | "mobile";
}) {
  const s = theme.styles;
  const c = theme.content;
  const v = theme.visibility;
  const radius = `${s.cardRadius}px`;
  const heading = { color: s.headingColor, fontFamily: fontStack(s.headingFont) };
  const body = { color: s.textColor, fontFamily: fontStack(s.bodyFont) };
  const mobile = device === "mobile";
  const socialEntries = Object.entries(socials).filter(([, x]) => x && x.trim());
  const mv = (t: string) => ({ __html: renderMerge(t, vars) });

  const Logo = () => v.showLogo ? (
    <p className="mb-5 text-center text-lg font-extrabold tracking-tight" style={{ color: s.primaryColor }}>{logoText || "Sipfluence"}</p>
  ) : null;

  const Badge = ({ center = true }: { center?: boolean }) => v.showBadge && c.badge ? (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${center ? "" : ""}`}
      style={{ background: `${s.accentColor}22`, color: s.headingColor }} dangerouslySetInnerHTML={mv(c.badge)} />
  ) : null;

  const Heading = ({ className = "" }: { className?: string }) => (
    <h1 className={`text-2xl font-bold leading-tight ${className}`} style={heading} dangerouslySetInnerHTML={mv(c.headline)} />
  );
  const Desc = ({ className = "" }: { className?: string }) => c.description ? (
    <p className={`mt-2 text-sm ${className}`} style={body} dangerouslySetInnerHTML={mv(c.description)} />
  ) : null;

  const ShopBtn = () => (
    <a href={shopLink} className="mt-6 flex w-full items-center justify-center gap-2 px-6 py-4 font-semibold shadow-sm transition-transform hover:scale-[1.02]"
      style={{ background: s.primaryColor, color: "#fff", borderRadius: radius }}>
      {c.shopLabel || "Shop my favorites"} <ArrowRight className="size-4" />
    </a>
  );

  const Coupon = () => v.showCoupon ? (
    <div className="mt-4 flex w-full items-center justify-between gap-3 px-5 py-4" style={{ border: `1px dashed ${s.primaryColor}66`, borderRadius: radius, background: `${s.primaryColor}0f` }}>
      <div>
        <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide" style={{ color: s.textColor }}>
          <Ticket className="size-3.5" style={{ color: s.accentColor }} /> {c.couponLabel || "Save with my code"}
        </p>
        <p className="text-xl font-bold tracking-wide" style={{ color: s.primaryColor }}>{code}</p>
      </div>
      <CopyButton value={code} />
    </div>
  ) : null;

  const Terms = () => v.showTerms ? (
    <p className="mt-3 text-center text-[11px]" style={{ color: s.textColor, opacity: 0.7 }}>Discount applies at checkout. Terms may apply.</p>
  ) : null;

  const Socials = () => v.showSocials && socialEntries.length > 0 ? (
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      {socialEntries.map(([key, url]) => {
        const Icon = SOCIAL_ICONS[key.toLowerCase()] ?? Globe;
        const href = url.startsWith("http") ? url : key.toLowerCase() === "instagram" ? `https://instagram.com/${url.replace(/^@/, "")}` : `https://${url}`;
        return (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={key}
            className="flex size-11 items-center justify-center rounded-full" style={{ background: s.cardColor, color: s.textColor, border: `1px solid ${s.primaryColor}22` }}>
            <Icon className="size-5" />
          </a>
        );
      })}
    </div>
  ) : null;

  const Footer = () => (
    <p className="mt-10 text-center text-[11px]" style={{ color: s.textColor, opacity: 0.6 }}>{c.footerText || "Powered by Sipfluence"}</p>
  );

  const width = mobile ? "max-w-[360px]" : "max-w-md";

  return (
    <div style={{ background: s.backgroundColor, fontFamily: fontStack(s.bodyFont) }} className="min-h-full w-full">
      {/* ---------------- BANNER HERO ---------------- */}
      {theme.layout === "banner" && (
        <div>
          {v.showHero && c.bannerImageUrl && (
            <div className="relative h-44 w-full overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.bannerImageUrl} alt="" className="size-full object-cover" />
              <div className="absolute inset-0" style={{ background: s.headingColor, opacity: s.overlayOpacity / 100 }} />
              <div className="absolute inset-0 flex items-center justify-center"><Logo /></div>
            </div>
          )}
          <div className={`mx-auto ${width} px-5 py-8 text-center`}>
            {!(v.showHero && c.bannerImageUrl) && <Logo />}
            <Badge />
            <Heading className="mt-3 text-center" />
            <Desc className="mx-auto max-w-sm text-center" />
            <Coupon /><Terms /><ShopBtn /><Socials /><Footer />
          </div>
        </div>
      )}

      {/* ---------------- SPLIT HERO ---------------- */}
      {theme.layout === "split" && (
        <div className={`mx-auto flex ${mobile ? "max-w-[360px] flex-col" : "max-w-3xl flex-col md:flex-row"} min-h-full`}>
          <div className="relative md:w-1/2">
            {v.showHero && c.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.heroImageUrl} alt="" className="h-48 w-full object-cover md:h-full" />
            ) : (
              <div className="h-40 w-full md:h-full" style={{ background: `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})` }} />
            )}
          </div>
          <div className="px-6 py-8 md:w-1/2">
            <Logo /><Badge />
            <Heading className="mt-3" />
            {c.subheadline && <p className="mt-1 text-sm font-medium" style={{ color: s.primaryColor }} dangerouslySetInnerHTML={mv(c.subheadline)} />}
            <Desc /><Coupon /><Terms /><ShopBtn /><Socials /><Footer />
          </div>
        </div>
      )}

      {/* ---------------- PRODUCT GRID ---------------- */}
      {theme.layout === "grid" && (
        <div className={`mx-auto ${mobile ? "max-w-[360px]" : "max-w-xl"} px-5 py-8`}>
          <Logo /><Heading className="text-center" /><Desc className="text-center" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            {c.products.map((p, i) => (
              <div key={i} className="overflow-hidden" style={{ background: s.cardColor, borderRadius: radius, border: `1px solid ${s.primaryColor}18` }}>
                <div className="aspect-square w-full" style={{ background: `${s.primaryColor}0d` }}>
                  {p.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.image} alt="" className="size-full object-cover" />
                    : <span className="flex size-full items-center justify-center text-xs" style={{ color: s.textColor, opacity: 0.5 }}>No image</span>}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold" style={{ color: s.headingColor }}>{p.name}</p>
                  <p className="mt-0.5 text-xs">
                    {p.salePrice
                      ? <><span style={{ color: s.primaryColor, fontWeight: 700 }}>{p.salePrice}</span> <span style={{ color: s.textColor, opacity: 0.5, textDecoration: "line-through" }}>{p.price}</span></>
                      : <span style={{ color: s.textColor }}>{p.price}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <Coupon /><Terms /><ShopBtn /><Socials /><Footer />
        </div>
      )}

      {/* ---------------- TESTIMONIAL STACK ---------------- */}
      {theme.layout === "testimonials" && (
        <div className={`mx-auto ${width} px-5 py-8`}>
          <Logo /><Heading className="text-center" /><Desc className="text-center" />
          <div className="mt-6 space-y-3">
            {c.testimonials.map((t, i) => (
              <div key={i} className="p-4" style={{ background: s.cardColor, borderRadius: radius, border: `1px solid ${s.primaryColor}18` }}>
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, j) => <Star key={j} className="size-3.5" style={{ color: s.accentColor, fill: s.accentColor }} />)}</div>
                <p className="mt-2 text-sm" style={body}>&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-3 flex items-center gap-2">
                  {t.avatar
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={t.avatar} alt="" className="size-7 rounded-full object-cover" />
                    : <span className="grid size-7 place-items-center rounded-full text-[10px] font-bold" style={{ background: `${s.primaryColor}22`, color: s.primaryColor }}>{t.name.charAt(0)}</span>}
                  <span className="text-xs font-medium" style={{ color: s.headingColor }}>{t.name}</span>
                  <span className="ml-auto text-[10px]" style={{ color: s.accentColor }}>✓ Verified Buyer</span>
                </div>
              </div>
            ))}
          </div>
          <Coupon /><Terms /><ShopBtn /><Socials /><Footer />
        </div>
      )}

      {/* ---------------- STORY CARD ---------------- */}
      {theme.layout === "story" && (
        <div className="relative mx-auto min-h-full w-full overflow-hidden" style={{ maxWidth: mobile ? 360 : 460 }}>
          {c.heroImageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={c.heroImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
            : <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${s.primaryColor}, ${s.headingColor})` }} />}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, ${s.headingColor}00, ${s.headingColor})`, opacity: 0.4 + s.overlayOpacity / 200 }} />
          <div className="relative flex min-h-[560px] flex-col items-center justify-end px-6 py-8 text-center">
            <div className="absolute left-0 right-0 top-6"><p className="text-center text-sm font-extrabold tracking-widest" style={{ color: "#fff" }}>{v.showLogo ? (logoText || "Sipfluence").toUpperCase() : ""}</p></div>
            <Badge />
            <h1 className="mt-3 text-3xl font-bold leading-tight text-white" style={{ fontFamily: fontStack(s.headingFont) }} dangerouslySetInnerHTML={mv(c.headline)} />
            {c.description && <p className="mt-2 text-sm text-white/90" dangerouslySetInnerHTML={mv(c.description)} />}
            {v.showCoupon && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2 backdrop-blur" style={{ background: "#ffffff22", border: "1px solid #ffffff55" }}>
                <span className="text-xs text-white/80">{c.couponLabel}</span>
                <span className="text-sm font-bold text-white">{code}</span>
              </div>
            )}
            <a href={shopLink} className="mt-5 flex w-full items-center justify-center gap-2 px-6 py-4 font-semibold" style={{ background: s.primaryColor, color: "#fff", borderRadius: radius }}>
              {c.shopLabel || "Shop my favorites"} <ArrowRight className="size-4" />
            </a>
          </div>
        </div>
      )}

      {/* ---------------- VIDEO EMBED ---------------- */}
      {theme.layout === "video" && (
        <div className={`mx-auto ${width} px-5 py-8`}>
          <Logo />
          {videoEmbed(c.videoUrl)
            ? <div className="overflow-hidden" style={{ borderRadius: radius }}><div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe src={videoEmbed(c.videoUrl)!} className="absolute inset-0 size-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="video" />
              </div></div>
            : <div className="flex aspect-video w-full items-center justify-center" style={{ background: `${s.primaryColor}12`, borderRadius: radius }}>
                <span className="grid size-14 place-items-center rounded-full" style={{ background: s.primaryColor }}><Play className="size-6 text-white" /></span>
              </div>}
          <div className="mt-5 text-center">
            <Badge /><Heading className="mt-2 text-center" />
            {c.subheadline && <p className="mt-1 text-sm" style={{ color: s.primaryColor }} dangerouslySetInnerHTML={mv(c.subheadline)} />}
            <Desc className="text-center" />
          </div>
          <Coupon /><Terms /><ShopBtn /><Socials /><Footer />
        </div>
      )}

      {/* ---------------- QUIZ RESULT ---------------- */}
      {theme.layout === "quiz" && (
        <QuizLayout theme={theme} code={code} shopLink={shopLink} logoText={logoText} vars={vars} width={width}
          Logo={Logo} Coupon={Coupon} ShopBtn={ShopBtn} Socials={Socials} Footer={Footer} />
      )}

      {/* ---------------- SINGLE COLUMN (default) ---------------- */}
      {theme.layout === "single" && (
        <div className={`mx-auto ${width} px-5 py-10`}>
          <Logo />
          <div style={{ background: s.cardColor, borderRadius: radius }} className="px-6 py-7">
            <Heading className="text-center" /><Desc className="text-center" />
            {v.showHero && c.heroImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.heroImageUrl} alt="" className="mt-5 w-full object-cover" style={{ borderRadius: radius, maxHeight: 200 }} />
            )}
            <Coupon /><Terms /><ShopBtn />
          </div>
          <Socials /><Footer />
        </div>
      )}
    </div>
  );
}

function QuizLayout({ theme, code, shopLink, vars, width, Logo, Coupon, ShopBtn, Socials, Footer }: any) {
  const s = theme.styles; const c = theme.content;
  const [pick, setPick] = useState<number | null>(null);
  const radius = `${s.cardRadius}px`;
  const heading = { color: s.headingColor, fontFamily: fontStack(s.headingFont) };
  const ans = pick != null ? c.quizAnswers[pick] : null;
  return (
    <div className={`mx-auto ${width} px-5 py-9`}>
      <Logo />
      <h1 className="text-center text-2xl font-bold" style={heading} dangerouslySetInnerHTML={{ __html: renderMerge(c.quizQuestion, vars) }} />
      {!ans ? (
        <div className="mt-6 space-y-3">
          {c.quizAnswers.map((a: any, i: number) => (
            <button key={i} type="button" onClick={() => setPick(i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium transition-colors"
              style={{ background: s.cardColor, borderRadius: radius, border: `1px solid ${s.primaryColor}22`, color: s.headingColor }}>
              {a.label} <ArrowRight className="size-4" style={{ color: s.primaryColor }} />
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: s.primaryColor }}>{c.quizResultLabel}</p>
          {ans.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ans.image} alt="" className="mx-auto mt-3 h-40 w-full object-cover" style={{ borderRadius: radius, maxWidth: 320 }} />
          )}
          <h2 className="mt-3 text-xl font-bold" style={heading}>{ans.resultTitle}</h2>
          <p className="mt-1 text-sm" style={{ color: s.textColor }}>{ans.resultDesc}</p>
          <Coupon /><ShopBtn />
          <button type="button" onClick={() => setPick(null)} className="mt-3 text-xs underline" style={{ color: s.textColor, opacity: 0.7 }}>Retake</button>
        </div>
      )}
      <Socials /><Footer />
    </div>
  );
}
