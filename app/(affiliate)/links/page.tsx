import { Gift, Ticket, QrCode, Share2 } from "lucide-react";
import { ShareButtons } from "@/components/affiliate/share-buttons";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { DeepLinkBuilder } from "@/components/affiliate/deep-link-builder";
import { requireAffiliate } from "@/lib/session";
import { buildReferralLink, qrDataUrl, APP_URL } from "@/lib/links";
import { getDefaultDestination } from "@/lib/queries";

export const metadata = { title: "Links & Codes" };

export default async function LinksPage() {
  const me = await requireAffiliate();
  const destination = await getDefaultDestination();
  const link = buildReferralLink(me.refCode, destination);
  const qr = await qrDataUrl(link);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your links & codes"
        description="Share these anywhere. Every sale from your code or link is tracked to you — automatically."
      />

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
