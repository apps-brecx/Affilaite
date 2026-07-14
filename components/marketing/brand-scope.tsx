import { hexToHslTriple, type BrandSettings } from "@/lib/campaign-config";

/**
 * Applies brand colors to a subtree by overriding the CSS custom properties
 * that the design system reads (hsl(var(--primary)) etc.). Server component —
 * just a styled wrapper, so it works around any children.
 */
export function BrandScope({ brand, children }: { brand: BrandSettings; children: React.ReactNode }) {
  const primary = hexToHslTriple(brand.primaryColor);
  const gold = hexToHslTriple(brand.accentColor);
  const style = {
    ["--primary" as any]: primary,
    ["--ring" as any]: primary,
    ["--gold" as any]: gold,
  } as React.CSSProperties;
  return <div style={style}>{children}</div>;
}
