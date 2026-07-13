import { UserPlus, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { AffiliatesTable } from "@/components/admin/affiliates-table";
import { listAffiliates } from "@/lib/queries";

export const metadata = { title: "Affiliates" };

export default async function AffiliatesPage() {
  const affiliates = await listAffiliates();
  return (
    <div className="space-y-8">
      <PageHeader title="Affiliates" description="Approve, organize, and grow your partner roster.">
        <Button variant="secondary">
          <Download className="size-4" /> Export
        </Button>
        <Button>
          <UserPlus className="size-4" /> Invite affiliate
        </Button>
      </PageHeader>
      <AffiliatesTable affiliates={affiliates} />
    </div>
  );
}
