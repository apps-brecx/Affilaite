import { notFound } from "next/navigation";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { CampaignThemeStudio } from "@/components/admin/campaign-theme-studio";
import { getCampaign } from "@/lib/queries";
import { mergeCampaignBrand } from "@/lib/campaign-config";

export default async function CampaignThemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const brand = mergeCampaignBrand(campaign.config.brand);
  const r = campaign.rewardValue;
  const rewardLine =
    campaign.type === "referral"
      ? `Give ${campaign.rewardType === "percent" ? `${r}%` : `$${r}`}, get ${campaign.friendRewardType === "percent" ? `${campaign.friendRewardValue}%` : `$${campaign.friendRewardValue}`}`
      : `Earn ${campaign.rewardType === "percent" ? `${r}%` : `$${r}`} commission`;

  return (
    <div className="space-y-8">
      <CampaignHeader campaign={campaign} backToCampaign />
      <div>
        <h1 className="font-display text-xl font-semibold">Theme studio</h1>
        <p className="text-sm text-muted-foreground">Design the /join page for this campaign — logo, colors, hero and copy. Changes preview live.</p>
      </div>
      <CampaignThemeStudio campaignId={campaign.id} campaignName={campaign.name} brand={brand} rewardLine={rewardLine} />
    </div>
  );
}
