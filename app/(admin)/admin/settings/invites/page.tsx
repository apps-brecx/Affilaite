import { PageHeader } from "@/components/ui/page-header";
import { TeamInviteEmailBuilder } from "@/components/admin/team-invite-email";
import { requireOwner } from "@/lib/session";
import { getTeamInviteEmail, getEmailBrand } from "@/lib/email-center";
import { emailReady } from "@/lib/integrations";

export const metadata = { title: "Settings · Team invites" };

export default async function TeamInvitesSettingsPage() {
  await requireOwner();
  const [template, brand, ready] = await Promise.all([getTeamInviteEmail(), getEmailBrand(), emailReady()]);

  return (
    <div className="space-y-8">
      <PageHeader title="Team invites" description="Design the email new team members receive when you add them in Team & access." />
      {!ready && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          Resend isn&apos;t connected, so invites won&apos;t email automatically — you&apos;ll get each member&apos;s temporary password to share instead. Connect it in{" "}
          <a href="/admin/settings/integrations" className="font-medium underline">Integrations</a>.
        </div>
      )}
      <TeamInviteEmailBuilder
        template={template}
        brand={{ logoText: brand.logoText, logoUrl: brand.logoUrl, primaryColor: brand.primaryColor, footerText: brand.footerText }}
      />
    </div>
  );
}
