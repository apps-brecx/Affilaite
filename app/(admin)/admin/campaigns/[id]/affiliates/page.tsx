import { notFound } from "next/navigation";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { CampaignMembers } from "@/components/admin/campaign-members";
import { getCampaign, getCampaignMemberIds, listAffiliates } from "@/lib/queries";

export default async function CampaignAffiliatesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const [memberIds, affiliates] = await Promise.all([getCampaignMemberIds(id), listAffiliates()]);
  const memberSet = new Set(memberIds);
  const members = affiliates.filter((a) => memberSet.has(a.id));
  const candidates = affiliates.filter((a) => a.status === "approved" && !memberSet.has(a.id));

  return (
    <div className="space-y-8">
      <CampaignHeader campaign={campaign} backToCampaign />
      <CampaignMembers campaignId={id} members={members} candidates={candidates} />
    </div>
  );
}
