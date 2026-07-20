import { notFound } from "next/navigation";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { CampaignSettingsForm } from "@/components/admin/campaign-settings-form";
import { getCampaign } from "@/lib/queries";
import { APP_URL } from "@/lib/links";

export default async function CampaignSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  return (
    <div className="space-y-8">
      <CampaignHeader campaign={campaign} backToCampaign />
      <CampaignSettingsForm campaign={campaign} appUrl={APP_URL} />
    </div>
  );
}
