import { PageHeader } from "@/components/ui/page-header";
import { BrandSettingsCard } from "@/components/admin/brand-settings";
import { getBrand } from "@/lib/queries";

export const metadata = { title: "Settings · Brand & theme" };

export default async function BrandSettingsPage() {
  const brand = await getBrand();
  return (
    <div className="space-y-8">
      <PageHeader title="Brand & theme" description="Style the pages partners see — signup, login, and the approved screen." />
      <BrandSettingsCard brand={brand} />
    </div>
  );
}
