import { Ticket } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DiscountManager } from "@/components/admin/discount-manager";
import { listAffiliates, listDiscountCodes } from "@/lib/queries";
import { shopifyReady } from "@/lib/integrations";

export const metadata = { title: "Discount Codes" };

export default async function CodesPage() {
  const [affiliates, codes, shopifyConnected] = await Promise.all([
    listAffiliates(),
    listDiscountCodes(),
    shopifyReady(),
  ]);
  const targets = affiliates
    .filter((a) => a.status === "approved")
    .map((a) => ({ id: a.id, name: a.name, refCode: a.refCode }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Discount codes"
        description="Create, edit, and manage every affiliate discount code — synced to Shopify in real time."
      >
        <Badge variant={shopifyConnected ? "success" : "muted"}>
          {shopifyConnected ? "Shopify connected" : "Shopify offline"}
        </Badge>
      </PageHeader>
      <DiscountManager codes={codes} targets={targets} shopifyConnected={shopifyConnected} />
    </div>
  );
}
