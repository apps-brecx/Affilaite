import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Instagram, Globe, Youtube, Music2, Twitter, Facebook, ArrowRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CopyButton } from "@/components/ui/copy-button";
import { getPublicProfile } from "@/lib/social";
import { buildReferralLink, STORE_URL } from "@/lib/links";

export const dynamic = "force-dynamic";

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  instagram: Instagram,
  website: Globe,
  youtube: Youtube,
  tiktok: Music2,
  x: Twitter,
  twitter: Twitter,
  facebook: Facebook,
};

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const profile = await getPublicProfile(handle);
  if (!profile) return { title: "Not found" };
  return {
    title: `${profile.name} — shop my picks`,
    description: profile.bio ?? `Use code ${profile.code} for a treat.`,
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getPublicProfile(handle);
  if (!profile) notFound();

  const shopLink = buildReferralLink(profile.refCode, STORE_URL);
  const socialEntries = Object.entries(profile.socials).filter(([, v]) => v && v.trim());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center px-5 py-12">
      <Avatar name={profile.name} size={88} />
      <h1 className="mt-4 font-display text-2xl font-bold">{profile.name}</h1>
      {profile.bio && <p className="mt-2 text-center text-sm text-muted-foreground">{profile.bio}</p>}

      {/* Primary CTA */}
      <a
        href={shopLink}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-semibold text-primary-foreground shadow-card transition-transform hover:scale-[1.02]"
      >
        Shop my favorites <ArrowRight className="size-4" />
      </a>

      {/* Coupon */}
      <div className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Save with my code</p>
          <p className="font-display text-xl font-bold tracking-wide text-primary">{profile.code}</p>
        </div>
        <CopyButton value={profile.code} />
      </div>

      {/* Socials */}
      {socialEntries.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {socialEntries.map(([key, url]) => {
            const Icon = SOCIAL_ICONS[key.toLowerCase()] ?? Globe;
            const href = url.startsWith("http") ? url : key.toLowerCase() === "instagram" ? `https://instagram.com/${url.replace(/^@/, "")}` : `https://${url}`;
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-11 items-center justify-center rounded-full border border-hairline bg-card text-muted-foreground transition-colors hover:text-primary"
                aria-label={key}
              >
                <Icon className="size-5" />
              </a>
            );
          })}
        </div>
      )}

      <p className="mt-auto pt-10 text-center text-[11px] text-muted-foreground">Powered by Sipfluence</p>
    </main>
  );
}
