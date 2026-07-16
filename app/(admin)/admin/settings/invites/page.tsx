import { PageHeader } from "@/components/ui/page-header";
import { InviteTemplates } from "@/components/admin/invite-templates";
import { listInviteTemplates } from "@/lib/queries";

export const metadata = { title: "Settings · Invite templates" };

export default async function InviteTemplatesSettingsPage() {
  const templates = await listInviteTemplates();
  return (
    <div className="space-y-8">
      <PageHeader title="Invite templates" description="Design the email new partners receive. Pick a template each time you invite." />
      <InviteTemplates templates={templates} />
    </div>
  );
}
