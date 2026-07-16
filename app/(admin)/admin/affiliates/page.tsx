import { PageHeader } from "@/components/ui/page-header";
import { AffiliatesTable } from "@/components/admin/affiliates-table";
import { AffiliatesToolbar } from "@/components/admin/affiliates-toolbar";
import { listAffiliates, listInviteTemplates } from "@/lib/queries";

export const metadata = { title: "Affiliates" };

export default async function AffiliatesPage() {
  const [affiliates, templates] = await Promise.all([listAffiliates(), listInviteTemplates()]);
  return (
    <div className="space-y-8">
      <PageHeader title="Affiliates" description="Approve, invite, organize, and grow your partner roster.">
        <AffiliatesToolbar affiliates={affiliates} templates={templates} />
      </PageHeader>
      <AffiliatesTable affiliates={affiliates} />
    </div>
  );
}
