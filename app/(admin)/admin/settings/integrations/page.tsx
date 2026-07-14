import { ShoppingBag, Wallet, Mail, CheckCircle2, AlertCircle, Database, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Settings · Integrations" };

export default function IntegrationsSettingsPage() {
  const env = (k: string) => Boolean(process.env[k]);

  const services = [
    { icon: Database, label: "Database (Neon)", detail: env("DATABASE_URL") ? "Connected" : "Set DATABASE_URL to go live", ok: env("DATABASE_URL") },
    { icon: ShoppingBag, label: "Shopify", detail: env("SHOPIFY_ADMIN_TOKEN") ? process.env.SHOPIFY_STORE_DOMAIN ?? "Connected" : "Add store token to track orders", ok: env("SHOPIFY_ADMIN_TOKEN") },
    { icon: Wallet, label: "PayPal Payouts", detail: env("PAYPAL_CLIENT_ID") ? (process.env.PAYPAL_BASE?.includes("sandbox") ? "Sandbox" : "Live") : "Add PayPal keys to pay affiliates", ok: env("PAYPAL_CLIENT_ID") },
    { icon: Mail, label: "Email (Resend)", detail: env("RESEND_API_KEY") ? process.env.EMAIL_FROM ?? "Connected" : "Add Resend key to send broadcasts", ok: env("RESEND_API_KEY") },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title="Integrations" description="Connection health. Configure these via environment variables on your host." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <Card key={s.label} className="flex items-center gap-4 p-5">
            <span className={`flex size-11 items-center justify-center rounded-lg ${s.ok ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              <s.icon className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium">{s.label}</p>
              <p className="text-sm text-muted-foreground">{s.detail}</p>
            </div>
            {s.ok ? (
              <Badge variant="success"><CheckCircle2 className="size-3" /> Connected</Badge>
            ) : (
              <Badge variant="warning"><AlertCircle className="size-3" /> Not set</Badge>
            )}
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Secrets are managed as environment variables on your host (never stored in the app). See{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env.example</code> for the full list, and{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">docs/SHOPIFY_SETUP.md</code> to connect your store.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Register Shopify webhooks with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">npm run shopify:webhooks</code></li>
            <li>Commissions mature from pending → approved automatically after the hold period via the daily cron.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
