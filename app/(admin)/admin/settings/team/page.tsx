import { PageHeader } from "@/components/ui/page-header";
import { TeamManager } from "@/components/admin/team-manager";
import { requireOwner } from "@/lib/session";
import { listTeam } from "@/lib/team";
import { ADMIN_AREAS } from "@/lib/permissions";
import { emailReady } from "@/lib/integrations";

export const metadata = { title: "Team & access" };

export default async function TeamPage() {
  const me = await requireOwner();
  const [members, ready] = await Promise.all([listTeam(), emailReady()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Team & access"
        description="Invite people to the admin portal and choose exactly which areas each can open. You're the owner — you always have full access."
      />
      {!ready && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          Resend isn&apos;t connected, so invites won&apos;t email automatically — you&apos;ll get each member&apos;s temporary password to share. Connect it in{" "}
          <a href="/admin/settings/integrations" className="font-medium underline">Integrations</a>.
        </div>
      )}
      <TeamManager
        members={members}
        areas={ADMIN_AREAS.map((a) => ({ key: a.key, label: a.label }))}
        currentUserId={(me as any).id ?? ""}
      />
    </div>
  );
}
