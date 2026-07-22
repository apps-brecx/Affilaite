import Link from "next/link";
import { eq } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { FolpEditor } from "@/components/affiliate/folp-editor";
import { requireAffiliate } from "@/lib/session";
import { db } from "@/db";
import { affiliates } from "@/db/schema";
import { getFolpDefault } from "@/lib/folp-server";
import { getBrand } from "@/lib/queries";
import { buildReferralLink, STORE_URL, APP_URL } from "@/lib/links";

export const metadata = { title: "My Page" };
export const dynamic = "force-dynamic";

export default async function LandingPageEditor() {
  const me = await requireAffiliate();
  const [brand, folpBrand, row] = await Promise.all([
    getBrand(),
    getFolpDefault(),
    db ? db.query.affiliates.findFirst({ where: eq(affiliates.id, me.id) }) : Promise.resolve(null),
  ]);
  const shopLink = buildReferralLink(me.refCode, STORE_URL);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customize my Sipfluence Page"
        description="This is your shareable friend-offer page — your main link. Make it yours; the brand logo stays up top."
      >
        {me.handle ? (
          <a href={`/p/${me.handle}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary">
            View live <ExternalLink className="size-4" />
          </a>
        ) : (
          <Link href="/settings" className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-2 text-sm font-medium hover:border-primary/40 hover:text-primary">
            Set your handle first
          </Link>
        )}
      </PageHeader>

      {!me.handle && (
        <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
          Pick a page handle in <Link href="/settings" className="font-medium underline">Settings</Link> to get your public link
          ({APP_URL.replace(/^https?:\/\//, "")}/p/your-handle). You can still design your page now.
        </p>
      )}

      <FolpEditor
        brand={folpBrand}
        initialOverrides={(row?.folpTheme as Record<string, any>) ?? null}
        data={{
          name: me.name,
          code: me.code,
          shopLink,
          socials: me.socialLinks ?? {},
          logoText: brand.logoText || "Sipfluence",
          shopName: brand.logoText || "Sipfluence",
        }}
      />
    </div>
  );
}
