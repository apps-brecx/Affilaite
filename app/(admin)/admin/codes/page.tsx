import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DiscountGenerator } from "@/components/admin/discount-generator";
import { listAffiliates } from "@/lib/queries";

export const metadata = { title: "Discount Codes" };

export default async function CodesPage() {
  const affiliates = await listAffiliates();
  const targets = affiliates
    .filter((a) => a.status === "approved")
    .map((a) => ({ id: a.id, name: a.name, refCode: a.refCode }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bulk discount generator"
        description="Create a unique, trackable Shopify discount code for every affiliate in one pass."
      >
        <Badge variant="gold">⭐ Signature feature</Badge>
      </PageHeader>
      <DiscountGenerator targets={targets} />
    </div>
  );
}
