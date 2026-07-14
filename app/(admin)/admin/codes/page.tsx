import { Ticket } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
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
        description="Create a unique, trackable Shopify discount code for every approved affiliate in one pass."
      >
        <Badge variant="gold">Shopify</Badge>
      </PageHeader>
      {targets.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No approved affiliates yet"
          description="Approve affiliates first — each one gets a code automatically. Use this tool to bulk-generate a new campaign code for everyone at once."
        />
      ) : (
        <DiscountGenerator targets={targets} />
      )}
    </div>
  );
}
