import Link from "next/link";
import { Gift, Ticket, QrCode, Share2, Link2, ExternalLink, ArrowRight } from "lucide-react";
import { ShareButtons } from "@/components/affiliate/share-buttons";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { DeepLinkBuilder } from "@/components/affiliate/deep-link-builder";
import { requireAffiliate } from "@/lib/session";
import { buildReferralLink, qrDataUrl, APP_URL } from "@/lib/links";
import { getDefaultDestination, getEarningRate } from "@/lib/queries";
import { Percent } from "lucide-react";

export const metadata = { title: "Links & Codes" };

export default async function LinksPage() {
  const me = await requireAffiliate();
  const [destination, earning] = await Promise.all([getDefaultDestination(), getEarningRate(me.id)]);
  const link = buildReferralLink(me.refCode, destination);
  const qr = await qrDataUrl(link);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your links & codes"
        description="Share these anywhere. Every sale from your code or link is tracked to you — automatically."
      />

      {earning && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-gold/5 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-gilded">
                <Percent className="size-5" />
              </span>
              <div>
                <p className="text-sm text-muted-foreground">You earn</p>
                <p className="font-display text-2xl font-semibold tracking-tight">{earning.label}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right">
              {earning.source === "campaign" ? <>Through the <span className="font-medium text-foreground">{earning.sourceName}</span> campaign</> : <>On the <span className="font-medium text-foreground">{earning.sourceName}</span> program</>}
              <br className="hidden sm:block" /> on every eligible sale.
            </p>
          </div>
          {earning.campaigns.length > 1 && (
            <div className="mt-4 border-t border-primary/15 pt-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">You&apos;re in {earning.campaigns.length} campaigns — the most recent one sets your rate:</p>
              <div className="flex flex-wrap gap-2">
                {earning.campaigns.map((c) => (
                  <span key={c.name} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${c.applied ? "border-primary/40 bg-primary/10 font-medium text-foreground" : "border-hairline text-muted-foreground"}`}>
                    {c.name} · {c.label}{c.applied && " · active"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hero reward card */}
      <Card className="relative overflow-hidden">
        <div className="aurora pointer-events-none absolute inset-0" />
        <CardContent className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div className="space-y-6">
            {/* Discount code */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Ticket className="size-4 text-gold" /> Your discount code
                <Badge variant="gold" className="ml-1">Customer discount</Badge>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/[0.06] p-2 pl-5 ring-gilded">
                <span className="flex-1 font-display text-3xl font-semibold tracking-wide text-foreground sm:text-4xl">
                  {me.code}
                </span>
                <CopyButton value={me.code} variant="full" label="Copy code" className="bg-gold text-gold-foreground hover:bg-gold/90" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Customers get a discount, you get commission. This is the most reliable way to earn —
                it works across every device with no cookies required.
              </p>
            </div>

            {/* Referral link */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Gift className="size-4 text-primary" /> Your referral link
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-hairline bg-background p-2 pl-4">
                <code className="flex-1 truncate font-mono text-sm text-foreground">{link}</code>
                <CopyButton value={link} variant="full" label="Copy link" />
              </div>
            </div>

            {/* Share */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Share2 className="size-4" /> Share to
              </p>
              <ShareButtons link={link} code={me.code} />
            </div>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-card p-6">
            <div
              role="img"
              aria-label="QR code for your referral link"
              className="size-44 [&_svg]:size-full [&_svg]:text-primary"
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <QrCode className="size-3.5" /> Scan to shop
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Link-in-bio page */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <Link2 className="size-5" />
            </span>
            <div>
              <p className="font-medium">Your link-in-bio page</p>
              <p className="text-sm text-muted-foreground">
                {me.handle ? (
                  <>One tidy page with your code &amp; links — perfect for your social bio.</>
                ) : (
                  <>Create a shareable page for your social bio in{" "}
                    <Link href="/settings" className="font-medium text-primary hover:underline">Settings</Link>.</>
                )}
              </p>
              {me.handle && (
                <code className="mt-1 inline-block truncate font-mono text-xs text-muted-foreground">
                  {APP_URL.replace(/^https?:\/\//, "")}/p/{me.handle}
                </code>
              )}
            </div>
          </div>
          {me.handle ? (
            <div className="flex shrink-0 items-center gap-2">
              <CopyButton value={`${APP_URL}/p/${me.handle}`} variant="outline" label="Copy link" />
              <a
                href={`/p/${me.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
              >
                View <ExternalLink className="size-4" />
              </a>
            </div>
          ) : (
            <Link
              href="/settings"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Set it up <ArrowRight className="size-4" />
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Deep link builder */}
      <Card>
        <CardHeader>
          <CardTitle>Product deep-links</CardTitle>
          <p className="text-sm text-muted-foreground">
            Send followers straight to a specific product with your attribution baked in.
          </p>
        </CardHeader>
        <CardContent>
          <DeepLinkBuilder refCode={me.refCode} appUrl={APP_URL} defaultDestination={destination} />
        </CardContent>
      </Card>
    </div>
  );
}
