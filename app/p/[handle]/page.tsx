import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FolpView } from "@/components/affiliate/folp-view";
import { getPublicProfile } from "@/lib/social";
import { getMergedFolp } from "@/lib/folp-server";
import { collectionUrl } from "@/lib/favorites";
import { getShopBrand } from "@/lib/shop-brand";
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

  const [theme, shop, favUrl] = await Promise.all([
    getMergedFolp(profile.id),
    getShopBrand(),
    collectionUrl(profile.favoriteCollectionHandle),
  ]);
  // Shop button → the affiliate's own favorites collection ONLY when they've built
  // one with at least one product; otherwise "Shop Syruvia" → the store home.
  const hasFavorites = !!profile.favoriteCollectionHandle && profile.favoriteCount > 0 && !!favUrl;
  const shopLink = buildReferralLink(profile.refCode, hasFavorites ? favUrl! : STORE_URL);
  const shopName = shop.name || "Syruvia";

  return (
    <main className="min-h-screen">
      <FolpView
        fill
        theme={theme}
        logoText={shopName}
        logoUrl={shop.logo}
        logoDarkUrl={shop.logoDark}
        name={profile.name}
        code={profile.code}
        shopLink={shopLink}
        shopLabelOverride={hasFavorites ? null : `Shop with ${shopName}`}
        socials={profile.socials}
        vars={{ first_name: profile.name.split(" ")[0], shop_name: shopName, code: profile.code, offer: "" }}
      />
    </main>
  );
}
