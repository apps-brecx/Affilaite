import Link from "next/link";
import { notFound } from "next/navigation";
import { Zap, ShieldCheck, Lock, Gift, Users } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinForm } from "@/components/marketing/join-form";
import { BrandScope } from "@/components/marketing/brand-scope";
import { getCampaignBySlug, getBrand } from "@/lib/queries";
import { phoneVerificationRequired } from "@/lib/phone";

export const dynamic = "force-dynamic";

function reward(v: number, t: string) {
  return t === "percent" ? `${v}%` : `$${v}`;
}

export default async function JoinCampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [campaign, brand] = await Promise.all([getCampaignBySlug(slug), getBrand()]);
  if (!campaign) notFound();

  const inviteOnly = campaign.access === "invite";
  const paused = campaign.status !== "active";
  const headline = brand.signupHeadline || campaign.name;
  const subtext = brand.signupSubtext || campaign.description;

  return (
    <BrandScope brand={brand}>
    <div className="relative min-h-screen">
      <div className="aurora pointer-events-none absolute inset-0 h-96" />
      <header className="relative mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo href="/" text={brand.logoText} />
        <ThemeToggle />
      </header>

      <div className="relative mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:py-16">
        {/* Left — campaign pitch */}
        <div className="lg:pt-6">
          <Badge variant={campaign.type === "referral" ? "gold" : "default"} className="mb-5">
            {campaign.type === "referral" ? <Gift className="size-3.5" /> : <Users className="size-3.5" />}
            {campaign.type === "referral" ? "Referral program" : "Affiliate program"}
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            {headline}
          </h1>
          {subtext && <p className="mt-4 max-w-md text-lg text-muted-foreground">{subtext}</p>}

          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-gilded">
                <Gift className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  {campaign.type === "referral"
                    ? `Give ${reward(campaign.rewardValue, campaign.rewardType)}, get ${reward(campaign.friendRewardValue, campaign.friendRewardType)}`
                    : `Earn ${reward(campaign.rewardValue, campaign.rewardType)} commission`}
                </p>
                <p className="text-xs text-muted-foreground">on every qualifying order</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-gilded">
                {campaign.access === "instant" ? <Zap className="size-4" /> : inviteOnly ? <Lock className="size-4" /> : <ShieldCheck className="size-4" />}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {campaign.access === "instant" ? "Instant access" : inviteOnly ? "Invite only" : "Quick approval"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {campaign.access === "instant"
                    ? "Your code & link are ready the moment you join"
                    : inviteOnly
                      ? "This campaign is open to invited partners only"
                      : "We review applications within 48 hours"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right — signup */}
        <div className="lg:pt-6">
          {inviteOnly || paused ? (
            <Card>
              <CardContent className="py-14 text-center">
                <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {inviteOnly ? <Lock className="size-6" /> : <ShieldCheck className="size-6" />}
                </span>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  {inviteOnly ? "Invite only" : "Not open right now"}
                </h2>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
                  {inviteOnly
                    ? "This campaign is open to invited partners only. If you have an account, sign in."
                    : "This campaign isn't accepting signups at the moment. Check back soon."}
                </p>
                <Button asChild variant="secondary" className="mt-5">
                  <Link href="/login">Sign in</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <JoinForm slug={campaign.slug!} instantAccess={campaign.access === "instant"} approvedMessage={brand.approvedMessage} requirePhone={await phoneVerificationRequired()} />
          )}
        </div>
      </div>
    </div>
    </BrandScope>
  );
}
