import Link from "next/link";
import { Rocket, Users, Gift, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { CampaignForm } from "@/components/admin/campaign-form";
import { listCampaigns } from "@/lib/queries";
import type { Campaign } from "@/lib/types";

export const metadata = { title: "Campaigns" };

function reward(v: number, t: string) {
  return t === "percent" ? `${v}%` : `$${v}`;
}

function CampaignCard({ c }: { c: Campaign }) {
  return (
    <Card className="group transition-shadow hover:shadow-lift">
      <CardContent className="flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <span
            className={`flex size-11 items-center justify-center rounded-xl ring-gilded ${
              c.type === "referral" ? "bg-gold/10 text-gold" : "bg-primary/10 text-primary"
            }`}
          >
            {c.type === "referral" ? <Gift className="size-5" /> : <Users className="size-5" />}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{c.name}</p>
              <StatusPill status={c.status} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {c.type === "referral"
                ? `Give ${reward(c.rewardValue, c.rewardType)} · Get ${reward(c.friendRewardValue, c.friendRewardType)}`
                : `${reward(c.rewardValue, c.rewardType)} commission`}
              {" · "}
              {c.memberCount} member{c.memberCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/campaigns/${c.id}`}>
            Manage <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();
  const affiliate = campaigns.filter((c) => c.type === "affiliate");
  const referral = campaigns.filter((c) => c.type === "referral");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Campaigns"
        description="Run affiliate campaigns for creators and referral campaigns for customers — assign affiliates to each."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {/* Affiliate campaigns */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Users className="size-4" /> Affiliate campaigns
            </h2>
            {affiliate.length === 0 ? (
              <p className="rounded-lg border border-dashed border-hairline py-8 text-center text-sm text-muted-foreground">
                No affiliate campaigns yet.
              </p>
            ) : (
              affiliate.map((c) => <CampaignCard key={c.id} c={c} />)
            )}
          </section>

          {/* Referral campaigns */}
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Gift className="size-4" /> Referral campaigns
            </h2>
            {referral.length === 0 ? (
              <p className="rounded-lg border border-dashed border-hairline py-8 text-center text-sm text-muted-foreground">
                No referral campaigns yet — create a give-get program to reward customer referrals.
              </p>
            ) : (
              referral.map((c) => <CampaignCard key={c.id} c={c} />)
            )}
          </section>
        </div>

        <CampaignForm />
      </div>
    </div>
  );
}
