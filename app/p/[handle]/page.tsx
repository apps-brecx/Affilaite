import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolpView } from "@/components/affiliate/folp-view";
import { getPublicProfile } from "@/lib/social";
import { getMergedFolp } from "@/lib/folp-server";
import { collectionUrl } from "@/lib/favorites";
import { getBrand } from "@/lib/queries";
import { buildReferralLink, STORE_URL } from "@/lib/links";

export const dynamic = "force-dynamic";

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

  const [theme, brand, favUrl] = await Promise.all([
    getMergedFolp(profile.id),
    getBrand(),
    collectionUrl(profile.favoriteCollectionHandle),
  ]);
  // Shop button → the affiliate's own favorites collection when they've built one.
  const shopLink = buildReferralLink(profile.refCode, favUrl ?? STORE_URL);

  return (
    <main className="min-h-screen">
      <FolpView
        theme={theme}
        logoText={brand.logoText || "Sipfluence"}
        name={profile.name}
        code={profile.code}
        shopLink={shopLink}
        socials={profile.socials}
        vars={{ first_name: profile.name.split(" ")[0], shop_name: brand.logoText || "Sipfluence", code: profile.code, offer: "" }}
      />
    </main>
  );
}
