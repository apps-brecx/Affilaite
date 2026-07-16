import { Wallet, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentsSettings } from "@/components/admin/payments-settings";
import { getSetting } from "@/lib/queries";
import { paypalConfig } from "@/lib/integrations";

export const metadata = { title: "Settings · Payments" };

export default async function PaymentsSettingsPage() {
  const [minimum, mode, pp] = await Promise.all([
    getSetting("default_payout_minimum", "25"),
    getSetting("default_payout_mode", "manual"),
    paypalConfig(),
  ]);
  const paypal = Boolean(pp.clientId && pp.clientSecret);
  const sandbox = pp.base.includes("sandbox");

  return (
    <div className="space-y-8">
      <PageHeader title="Payments" description="How affiliates get paid out." />

      <Card className="flex items-center gap-4 p-5">
        <span className={`flex size-11 items-center justify-center rounded-lg ${paypal ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Wallet className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-medium">PayPal Payouts</p>
          <p className="text-sm text-muted-foreground">
            {paypal ? (sandbox ? "Sandbox environment" : "Live environment") : "Add PAYPAL_CLIENT_ID / SECRET to enable payouts"}
          </p>
        </div>
        {paypal ? (
          <Badge variant="success"><CheckCircle2 className="size-3" /> Connected</Badge>
        ) : (
          <Badge variant="warning"><AlertCircle className="size-3" /> Not set</Badge>
        )}
      </Card>

      <PaymentsSettings minimum={minimum} mode={mode} />
    </div>
  );
}
