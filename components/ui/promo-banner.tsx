import { Button } from "@/components/ui/button";
import type { Banner } from "@/lib/queries";

/** Admin-configurable promo banner. Renders nothing when null/disabled. */
export function PromoBanner({ banner, fullBleed = false }: { banner: Banner | null; fullBleed?: boolean }) {
  if (!banner) return null;

  // Hero: a wide, rounded banner across the top with the copy overlaid. Uses a
  // separate mobile image when one is set, falling back to the desktop image.
  if (fullBleed) {
    const hasCopy = banner.title || banner.body || (banner.ctaLabel && banner.ctaUrl);
    const desktop = banner.imageUrl || banner.imageUrlMobile;
    const mobile = banner.imageUrlMobile || banner.imageUrl;
    return (
      <div className="relative mt-2 overflow-hidden rounded-2xl border border-hairline">
        {desktop || mobile ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mobile} alt="" className="h-44 w-full object-cover sm:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={desktop} alt="" className="hidden h-56 w-full object-cover sm:block lg:h-64" />
          </>
        ) : (
          <div className="h-40 w-full bg-gradient-to-br from-primary/20 to-gold/10 sm:h-48" />
        )}
        {hasCopy && (
          <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-6 sm:p-8">
            {banner.title && <p className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{banner.title}</p>}
            {banner.body && <p className="max-w-xl text-sm text-white/85">{banner.body}</p>}
            {banner.ctaLabel && banner.ctaUrl && (
              <Button asChild className="mt-2 w-fit">
                <a href={banner.ctaUrl} target="_blank" rel="noopener noreferrer">{banner.ctaLabel}</a>
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-gold/5 p-5 sm:flex-row sm:items-center">
      {banner.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={banner.imageUrl} alt="" className="h-24 w-full rounded-xl object-cover sm:w-40" />
      )}
      <div className="min-w-0 flex-1">
        {banner.title && <p className="font-display text-lg font-semibold tracking-tight">{banner.title}</p>}
        {banner.body && <p className="mt-1 text-sm text-muted-foreground">{banner.body}</p>}
      </div>
      {banner.ctaLabel && banner.ctaUrl && (
        <Button asChild className="shrink-0">
          <a href={banner.ctaUrl} target="_blank" rel="noopener noreferrer">{banner.ctaLabel}</a>
        </Button>
      )}
    </div>
  );
}
