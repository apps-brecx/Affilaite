import { PageHeader } from "@/components/ui/page-header";
import { FolpAdminEditor } from "@/components/admin/folp-admin-editor";
import { requireArea } from "@/lib/session";
import { getFolpDefault } from "@/lib/folp-server";
import { getBrand } from "@/lib/queries";

export const metadata = { title: "Landing page default" };
export const dynamic = "force-dynamic";

export default async function AdminFolpDefaultPage() {
  await requireArea("settings");
  const [folp, brand] = await Promise.all([getFolpDefault(), getBrand()]);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Affiliate landing page — brand default"
        description="The friend-offer page every affiliate starts from. Lock any field so affiliates can't change it (e.g. the logo)."
      />
      <FolpAdminEditor initial={folp} brandName={brand.logoText || "Sipfluence"} />
    </div>
  );
}
