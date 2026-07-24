import { PageHeader } from "@/components/ui/page-header";
import { FolpAdminEditor } from "@/components/admin/folp-admin-editor";
import { FolpCustomizations } from "@/components/admin/folp-customizations";
import { requireArea } from "@/lib/session";
import { getFolpDefault, listFolpCustomizations } from "@/lib/folp-server";
import { getShopBrand } from "@/lib/shop-brand";

export const metadata = { title: "Landing page default" };
export const dynamic = "force-dynamic";

export default async function AdminFolpDefaultPage() {
  await requireArea("settings");
  const [folp, shop, customizations] = await Promise.all([getFolpDefault(), getShopBrand(), listFolpCustomizations()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate landing page — brand default"
        description="The friend-offer page every affiliate starts from. Lock any field so affiliates can't change it (e.g. the logo). The store logo is pulled from Shopify."
      />
      <FolpAdminEditor initial={folp} brandName={shop.name || "Syruvia"} logoUrl={shop.logo} logoDarkUrl={shop.logoDark} />
      <FolpCustomizations items={customizations} />
    </div>
  );
}
