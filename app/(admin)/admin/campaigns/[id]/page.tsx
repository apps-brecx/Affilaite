import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Gift } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { CampaignManager } from "@/components/admin/campaign-manager";
import { CampaignRewards } from "@/components/admin/campaign-rewards";
import { CampaignHealth } from "@/components/admin/campaign-health";
import { getCampaign, getCampaignMemberIds, listAffiliates } from "@/lib/queries";
import { APP_URL } from "@/lib/links";

export default async function CampaignManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [memberIds, affiliates] = await Promise.all([getCampaignMemberIds(id), listAffiliates()]);
  const memberSet = new Set(memberIds);
  const members = affiliates.filter((a) => memberSet.has(a.id));
  const candidates = affiliates.filter((a) => a.status === "approved" && !memberSet.has(a.id));

  return (
    <div className="space-y-8">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All campaigns
      </Link>

      <PageHeader title={campaign.name} description={campaign.description || undefined}>
        <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-card px-3 py-1.5 text-sm">
          {campaign.type === "referral" ? <Gift className="size-4 text-gold" /> : <Users className="size-4 text-primary" />}
          <span className="capitalize text-muted-foreground">{campaign.type}</span>
        </span>
        <StatusPill status={campaign.status} />
      </PageHeader>

      <CampaignManager campaign={campaign} members={members} candidates={candidates} appUrl={APP_URL} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CampaignRewards campaign={campaign} />
        </div>
        <div className="lg:col-span-1">
          <CampaignHealth campaign={campaign} memberCount={members.length} />
        </div>
      </div>
    </div>
  );
}
