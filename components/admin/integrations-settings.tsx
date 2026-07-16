"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, Wallet, Mail, MessageSquare, CheckCircle2, AlertCircle, Loader2, Save, Unplug, Plug } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveIntegration, disconnectIntegration, testShopifyConnection } from "@/app/actions/admin";

export interface IntegrationsStatus {
  shopify: { ready: boolean; domain: string; version: string; tokenMask: string; secretMask: string };
  paypal: { ready: boolean; base: string; clientIdMask: string; clientSecretMask: string; webhookId: string };
  email: { ready: boolean; from: string; keyMask: string };
  sms: { ready: boolean; provider: string; from: string; keyMask: string; secretMask: string };
}

function StatusBadge({ ready }: { ready: boolean }) {
  return ready ? (
    <Badge variant="success"><CheckCircle2 className="size-3" /> Connected</Badge>
  ) : (
    <Badge variant="warning"><AlertCircle className="size-3" /> Not set</Badge>
  );
}

function IntegrationCard({
  service,
  icon: Icon,
  title,
  ready,
  children,
  fields,
  onTest,
}: {
  service: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  ready: boolean;
  children: React.ReactNode;
  fields: () => Record<string, string>;
  onTest?: () => Promise<{ ok: boolean; message: string }>;
}) {
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await saveIntegration(service, fields());
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  const test = () =>
    startTest(async () => {
      const res = await onTest!();
      toast(res.message, res.ok ? "success" : "error");
    });

  const disconnect = () => {
    if (!confirm(`Disconnect ${title}?`)) return;
    start(async () => {
      const res = await disconnectIntegration(service);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          {title}
        </CardTitle>
        <StatusBadge ready={ready} />
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <div className="flex items-center justify-between border-t border-hairline pt-4">
          {ready ? (
            <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={disconnect} disabled={pending}>
              <Unplug className="size-4" /> Disconnect
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {onTest && (
              <Button variant="secondary" size="sm" onClick={test} disabled={testing || pending}>
                {testing ? <Loader2 className="size-4 animate-spin" /> : <Plug className="size-4" />} Test
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save &amp; connect
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function IntegrationsSettings({ status }: { status: IntegrationsStatus }) {
  // Shopify
  const [domain, setDomain] = useState(status.shopify.domain);
  const [version, setVersion] = useState(status.shopify.version);
  const [token, setToken] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  // PayPal (also powers Venmo payouts)
  const [base, setBase] = useState(status.paypal.base || "https://api-m.sandbox.paypal.com");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [webhookId, setWebhookId] = useState(status.paypal.webhookId || "");
  // Email
  const [from, setFrom] = useState(status.email.from);
  const [apiKey, setApiKey] = useState("");
  // SMS (phone verification)
  const [smsProvider, setSmsProvider] = useState(status.sms.provider || "");
  const [smsFrom, setSmsFrom] = useState(status.sms.from || "");
  const [smsKey, setSmsKey] = useState("");
  const [smsSecret, setSmsSecret] = useState("");

  const secretPlaceholder = (mask: string) => (mask ? `${mask} — leave blank to keep` : "");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <IntegrationCard
        service="shopify"
        icon={ShoppingBag}
        title="Shopify"
        ready={status.shopify.ready}
        fields={() => ({ domain, version, token, apiSecret })}
        onTest={testShopifyConnection}
      >
        <Field label="Store domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="your-store.myshopify.com" />
        <Field label="Admin API access token" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={secretPlaceholder(status.shopify.tokenMask) || "shpat_…"} className="font-mono" />
        <Field label="API secret (webhook HMAC)" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder={secretPlaceholder(status.shopify.secretMask) || "••••••"} className="font-mono" />
        <Field label="API version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="2025-07" />
      </IntegrationCard>

      <IntegrationCard
        service="paypal"
        icon={Wallet}
        title="PayPal & Venmo Payouts"
        ready={status.paypal.ready}
        fields={() => ({ base, clientId, clientSecret, webhookId })}
      >
        <div className="rounded-lg bg-primary/[0.06] p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Venmo payouts run through this connection.</span> PayPal
          Payouts sends to Venmo using each affiliate&apos;s verified phone number — no separate Venmo login. Your
          PayPal business account must have Venmo payouts enabled.
        </div>
        <div className="space-y-1.5">
          <Label>Environment</Label>
          <select value={base} onChange={(e) => setBase(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
            <option value="https://api-m.sandbox.paypal.com">Sandbox</option>
            <option value="https://api-m.paypal.com">Live</option>
          </select>
        </div>
        <Field label="Client ID" type="password" value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={secretPlaceholder(status.paypal.clientIdMask) || "AeXf…"} className="font-mono" />
        <Field label="Client secret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={secretPlaceholder(status.paypal.clientSecretMask) || "EL9k…"} className="font-mono" />
        <Field label="Webhook ID" hint="From PayPal → Webhooks. Required to verify inbound payout status webhooks." value={webhookId} onChange={(e) => setWebhookId(e.target.value)} placeholder="4XY12345ABC…" className="font-mono" />
      </IntegrationCard>

      <IntegrationCard
        service="email"
        icon={Mail}
        title="Email (Resend)"
        ready={status.email.ready}
        fields={() => ({ from, apiKey })}
      >
        <Field label="API key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={secretPlaceholder(status.email.keyMask) || "re_…"} className="font-mono" />
        <Field label="From address" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Syruvia <affiliates@yourbrand.com>" />
      </IntegrationCard>

      <IntegrationCard
        service="sms"
        icon={MessageSquare}
        title="SMS (phone verification)"
        ready={status.sms.ready}
        fields={() => ({ provider: smsProvider, from: smsFrom, apiKey: smsKey, apiSecret: smsSecret })}
      >
        <div className="rounded-lg bg-primary/[0.06] p-3 text-xs text-muted-foreground">
          Sends the signup verification codes. <span className="font-medium text-foreground">Twilio is supported</span> —
          set Provider to <code className="rounded bg-muted px-1 py-0.5 font-mono">twilio</code> and enter your Account
          SID, Auth Token, and a From number (or Messaging Service SID). Leave Provider blank for demo mode (codes are
          logged, not texted).
        </div>
        <Field label="Provider" value={smsProvider} onChange={(e) => setSmsProvider(e.target.value)} placeholder="twilio" />
        <Field label="From number / Messaging Service SID" value={smsFrom} onChange={(e) => setSmsFrom(e.target.value)} placeholder="+1 555 000 1111 or MG…" />
        <Field label="Account SID" type="password" value={smsKey} onChange={(e) => setSmsKey(e.target.value)} placeholder={secretPlaceholder(status.sms.keyMask) || "AC…"} className="font-mono" />
        <Field label="Auth Token" type="password" value={smsSecret} onChange={(e) => setSmsSecret(e.target.value)} placeholder={secretPlaceholder(status.sms.secretMask) || "••••••"} className="font-mono" />
      </IntegrationCard>
    </div>
  );
}
