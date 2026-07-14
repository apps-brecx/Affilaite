import { Database, CheckCircle2, AlertCircle, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationsSettings } from "@/components/admin/integrations-settings";
import { integrationsStatus } from "@/lib/integrations";
import { dataSource } from "@/lib/queries";

export const metadata = { title: "Settings · Integrations" };

export default async function IntegrationsSettingsPage() {
  const status = await integrationsStatus();
  const dbReady = dataSource === "live";

  return (
    <div className="space-y-8">
      <PageHeader title="Integrations" description="Connect your store, payouts, and email — enter the keys right here." />

      {/* Database is configured via env only (the app needs it to boot). */}
      <Card className="flex items-center gap-4 p-5">
        <span className={`flex size-11 items-center justify-center rounded-lg ${dbReady ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          <Database className="size-5" />
        </span>
        <div className="flex-1">
          <p className="font-medium">Database (Neon)</p>
          <p className="text-sm text-muted-foreground">{dbReady ? "Connected" : "Set DATABASE_URL on your host"}</p>
        </div>
        {dbReady ? (
          <Badge variant="success"><CheckCircle2 className="size-3" /> Connected</Badge>
        ) : (
          <Badge variant="warning"><AlertCircle className="size-3" /> Not set</Badge>
        )}
      </Card>

      <IntegrationsSettings status={status} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" /> How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Keys you enter here are stored in your database with secrets <strong>encrypted at rest</strong>, and take
            precedence over environment variables. Leave a secret field blank to keep the current value.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>After connecting Shopify, register webhooks with <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">npm run shopify:webhooks</code>.</li>
            <li>Start PayPal in Sandbox, verify a payout, then switch to Live.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
