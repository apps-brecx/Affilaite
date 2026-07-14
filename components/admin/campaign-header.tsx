import Link from "next/link";
import { ArrowLeft, Users, Gift } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import { CampaignTabs } from "@/components/admin/campaign-tabs";
import { CampaignStatusToggle } from "@/components/admin/campaign-status-toggle";
import type { Campaign } from "@/lib/types";

export function CampaignHeader({ campaign }: { campaign: Campaign }) {
  return (
    <div className="space-y-5">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All campaigns
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`flex size-11 items-center justify-center rounded-xl ring-gilded ${campaign.type === "referral" ? "bg-gold/10 text-gold" : "bg-primary/10 text-primary"}`}>
            {campaign.type === "referral" ? <Gift className="size-5" /> : <Users className="size-5" />}
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">{campaign.name}</h1>
              <StatusPill status={campaign.status} />
            </div>
            <p className="text-sm capitalize text-muted-foreground">{campaign.type} campaign</p>
          </div>
        </div>
        <CampaignStatusToggle id={campaign.id} status={campaign.status} />
      </div>

      <CampaignTabs id={campaign.id} />
    </div>
  );
}
