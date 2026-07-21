import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { AffiliatesTable } from "@/components/admin/affiliates-table";
import { AffiliatesToolbar } from "@/components/admin/affiliates-toolbar";
import { listAffiliates, listInviteTemplates } from "@/lib/queries";
import { emailReady } from "@/lib/integrations";

export const metadata = { title: "Affiliates" };

export default async function AffiliatesPage() {
  const [affiliates, templates, mailReady] = await Promise.all([listAffiliates(), listInviteTemplates(), emailReady()]);
  return (
    <div className="space-y-8">
      <PageHeader title="Affiliates" description="Approve, invite, organize, and grow your partner roster.">
        <AffiliatesToolbar affiliates={affiliates} templates={templates} />
      </PageHeader>
      {!mailReady && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <p>
            Email isn&apos;t connected, so applicants aren&apos;t getting the &ldquo;application received&rdquo; confirmation
            (and approvals/invites won&apos;t email either). New applications still show up here and in the bell. Connect
            Resend in{" "}
            <a href="/admin/settings/integrations" className="font-medium underline">Settings → Integrations</a> to turn emails on.
          </p>
        </div>
      )}
      <AffiliatesTable affiliates={affiliates} />
    </div>
  );
}
