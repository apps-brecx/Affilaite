import { ShoppingBag, Wallet, Mail, CheckCircle2, KeyRound, Globe } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dataSource } from "@/lib/queries";

export const metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Connect your store, payment rails, and email — then check everything is healthy.">
        <Badge variant={dataSource === "live" ? "success" : "warning"}>
          {dataSource === "live" ? "Live database" : "Demo data"}
        </Badge>
      </PageHeader>

      {/* Connection health */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Health icon={ShoppingBag} label="Shopify" detail="orders + refunds webhooks" ok />
        <Health icon={Wallet} label="PayPal Payouts" detail="sandbox environment" ok />
        <Health icon={Mail} label="Resend email" detail="affiliates@yourbrand.com" ok />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ConfigCard
          icon={ShoppingBag}
          title="Shopify"
          fields={[
            { label: "Store domain", value: "your-store.myshopify.com", icon: Globe },
            { label: "Admin API token", value: "shpat_••••••••••••••••", icon: KeyRound, secret: true },
            { label: "API secret (HMAC)", value: "••••••••••••••••", icon: KeyRound, secret: true },
            { label: "API version", value: "2025-07" },
          ]}
        />
        <ConfigCard
          icon={Wallet}
          title="PayPal"
          fields={[
            { label: "Client ID", value: "AeXf••••••••••", icon: KeyRound, secret: true },
            { label: "Client secret", value: "EL9k••••••••••", icon: KeyRound, secret: true },
            { label: "Environment", value: "api-m.sandbox.paypal.com" },
          ]}
        />
        <ConfigCard
          icon={Mail}
          title="Email (Resend)"
          fields={[
            { label: "API key", value: "re_••••••••••••", icon: KeyRound, secret: true },
            { label: "From address", value: "affiliates@yourbrand.com" },
          ]}
        />
        <ConfigCard
          icon={KeyRound}
          title="Program defaults"
          fields={[
            { label: "Default hold period (days)", value: "30" },
            { label: "Default cookie window (days)", value: "30" },
            { label: "Payout minimum", value: "$25.00" },
          ]}
        />
      </div>
    </div>
  );
}

function Health({
  icon: Icon,
  label,
  detail,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  ok?: boolean;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {ok && (
        <Badge variant="success">
          <CheckCircle2 className="size-3" /> Connected
        </Badge>
      )}
    </Card>
  );
}

function ConfigCard({
  icon: Icon,
  title,
  fields,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  fields: { label: string; value: string; icon?: React.ComponentType<{ className?: string }>; secret?: boolean }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((f) => (
          <div key={f.label} className="space-y-1.5">
            <Label>{f.label}</Label>
            <div className="relative">
              {f.icon && (
                <f.icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <Input
                type={f.secret ? "password" : "text"}
                defaultValue={f.value}
                className={f.icon ? "pl-9 font-mono text-sm" : ""}
              />
            </div>
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm">Test connection</Button>
          <Button size="sm">Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}
