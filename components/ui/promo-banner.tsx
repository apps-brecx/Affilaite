import { Button } from "@/components/ui/button";
import type { Banner } from "@/lib/queries";

/** Admin-configurable promo banner. Renders nothing when null/disabled. */
export function PromoBanner({ banner }: { banner: Banner | null }) {
  if (!banner) return null;
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
