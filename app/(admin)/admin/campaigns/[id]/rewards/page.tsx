import { notFound } from "next/navigation";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { CampaignRewards } from "@/components/admin/campaign-rewards";
import { getCampaign } from "@/lib/queries";

export default async function CampaignRewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="space-y-8">
      <CampaignHeader campaign={campaign} backToCampaign />
      <div className="mx-auto max-w-3xl">
        <CampaignRewards campaign={campaign} />
      </div>
    </div>
  );
}
