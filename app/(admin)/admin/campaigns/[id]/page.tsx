import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift, Users, SlidersHorizontal, Settings2, Palette, ArrowRight, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { StatCard } from "@/components/ui/stat-card";
import { CampaignHeader } from "@/components/admin/campaign-header";
import { CampaignHealth } from "@/components/admin/campaign-health";
import { getCampaign, getCampaignMemberIds } from "@/lib/queries";
import { APP_URL } from "@/lib/links";
import type { Campaign } from "@/lib/types";

function money(v: number, t: string) {
  return t === "percent" ? `${v}%` : `$${v}`;
}

function rewardSummary(c: Campaign): string {
  const r = c.config.reward;
  if (r.kind === "custom") return r.custom || "Custom reward";
  const kind = r.kind === "coupon" ? "off coupon" : r.kind === "cash" ? "cash" : "store credit";
  return `${money(r.value, r.valueType)} ${kind}`;
}
function friendSummary(c: Campaign): string {
  const f = c.config.friend;
  if (f.kind === "none") return "Nothing";
  if (f.kind === "promo") return "Promo link";
  return `${money(f.value, f.valueType)} discount`;
}

export default async function CampaignOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const memberIds = await getCampaignMemberIds(id);
  const base = `/admin/campaigns/${id}`;
  const joinUrl = `${APP_URL}/join/${campaign.slug ?? ""}`;

  return (
    <div className="space-y-8">
      <CampaignHeader campaign={campaign} />

      {/* Promote */}
      {campaign.slug && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Promote your {campaign.type} program</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{joinUrl}</p>
            </div>
            <CopyButton value={joinUrl} variant="full" label="Copy link" />
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active affiliates" value={memberIds.length} format="number" icon={Users} accent="primary" hint="in this campaign" />
        <StatCard label="Commission" value={campaign.config.reward.value} format="raw" decimals={campaign.config.reward.valueType === "percent" ? 0 : 2} icon={Wallet} accent="gold" hint={campaign.config.reward.valueType === "percent" ? "percent" : "flat"} />
        <StatCard label="Reward type" value={0} format="number" icon={Gift} accent="success">
          <p className="-mt-2 text-sm font-medium capitalize text-foreground">{campaign.config.reward.kind}</p>
        </StatCard>
        <StatCard label="Payouts" value={0} format="number" icon={Wallet} accent="warning">
          <p className="-mt-2 text-sm font-medium capitalize text-foreground">{campaign.config.payout.mode}</p>
        </StatCard>
      </div>

      {/* Summary cards + health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Reward settings */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" /> Reward settings
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}/rewards`}>Manage rewards <ArrowRight className="size-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {campaign.type === "referral" ? "Advocates" : "Affiliates"} get:{" "}
                <span className="font-medium text-foreground">{rewardSummary(campaign)}</span>
                {campaign.config.reward.bonusEnabled && (
                  <span className="text-foreground"> + {money(campaign.config.reward.bonusValue, campaign.config.reward.bonusType)} bonus</span>
                )}
              </p>
              <p className="text-muted-foreground">
                Referred friends get: <span className="font-medium text-foreground">{friendSummary(campaign)}</span>
              </p>
              <p className="text-muted-foreground">
                Paid out: <span className="font-medium capitalize text-foreground">{campaign.config.payout.mode}</span>
                {campaign.config.conditions.minOrderType !== "none" && (
                  <> · Min order: <span className="text-foreground">{campaign.config.conditions.minOrderType === "amount" ? `$${campaign.config.conditions.minOrderValue}` : `${campaign.config.conditions.minOrderValue} orders`}</span></>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Affiliates */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-4 text-primary" /> Affiliates
              </CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}/affiliates`}>Manage affiliates <ArrowRight className="size-3.5" /></Link>
              </Button>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{memberIds.length}</span> affiliate{memberIds.length === 1 ? "" : "s"} in this campaign ·{" "}
              access is <span className="font-medium capitalize text-foreground">{campaign.access === "instant" ? "instant" : campaign.access === "invite" ? "invite only" : "by approval"}</span>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Settings */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="size-4 text-primary" /> Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Name, access, URL, short code, dates.</p>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`${base}/settings`}>Edit settings</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Brand & theme */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Palette className="size-4 text-primary" /> Theme &amp; content
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Logo, colors and copy for the pages partners see.</p>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`${base}/theme`}>Edit theme</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <CampaignHealth campaign={campaign} memberCount={memberIds.length} />
      </div>
    </div>
  );
}
