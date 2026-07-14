"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Gift, SlidersHorizontal, Ticket, Users2, Wallet, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { updateCampaignConfig } from "@/app/actions/admin";
import { cn } from "@/lib/utils";
import type { CampaignConfig, ValueType } from "@/lib/campaign-config";
import type { Campaign } from "@/lib/types";

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-hairline bg-muted/40 p-1">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-card text-foreground shadow-subtle" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ValueInput({
  valueType,
  onTypeChange,
  value,
  onValueChange,
}: {
  valueType: ValueType;
  onTypeChange: (v: ValueType) => void;
  value: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-2">
      <Input type="number" step="0.01" value={value} onChange={(e) => onValueChange(Number(e.target.value))} className="w-32" />
      <Segmented
        value={valueType}
        onChange={onTypeChange}
        options={[
          { value: "percent", label: "%" },
          { value: "fixed", label: "$" },
        ]}
      />
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded border-hairline accent-[hsl(var(--primary))]" />
      {label}
    </label>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: any; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-hairline pt-6 first:border-0 first:pt-0">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="font-medium">{title}</h3>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className="space-y-4 sm:pl-10">{children}</div>
    </div>
  );
}

export function CampaignRewards({ campaign }: { campaign: Campaign }) {
  const [cfg, setCfg] = useState<CampaignConfig>(campaign.config);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Immutable nested update helpers
  const upd = <K extends keyof CampaignConfig>(k: K, patch: Partial<CampaignConfig[K]>) =>
    setCfg((c) => ({ ...c, [k]: { ...c[k], ...patch } }));

  const advocateLabel = campaign.type === "referral" ? "Advocate reward" : "Affiliate reward";

  const save = () =>
    start(async () => {
      const res = await updateCampaignConfig(campaign.id, cfg);
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" /> Rewards &amp; rules
        </CardTitle>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Advocate / affiliate reward */}
        <Section icon={Gift} title={advocateLabel} desc="What the affiliate earns for a referred sale.">
          <Segmented
            value={cfg.reward.kind}
            onChange={(v) => upd("reward", { kind: v })}
            options={[
              { value: "coupon", label: "Coupon" },
              { value: "cash", label: "Cash" },
              { value: "credit", label: "Store credit" },
              { value: "custom", label: "Custom" },
            ]}
          />
          {cfg.reward.kind === "custom" ? (
            <div className="space-y-1.5">
              <Label>Custom reward</Label>
              <Input value={cfg.reward.custom} onChange={(e) => upd("reward", { custom: e.target.value })} placeholder="e.g. Free product gift" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <ValueInput
                valueType={cfg.reward.valueType}
                onTypeChange={(v) => upd("reward", { valueType: v })}
                value={cfg.reward.value}
                onValueChange={(v) => upd("reward", { value: v })}
              />
            </div>
          )}
          <div className="rounded-lg border border-hairline p-3">
            <Switch checked={cfg.reward.bonusEnabled} onCheckedChange={(v) => upd("reward", { bonusEnabled: v })} label="Bonus reward" description="An extra reward on top" />
            {cfg.reward.bonusEnabled && (
              <div className="mt-3">
                <ValueInput
                  valueType={cfg.reward.bonusType}
                  onTypeChange={(v) => upd("reward", { bonusType: v })}
                  value={cfg.reward.bonusValue}
                  onValueChange={(v) => upd("reward", { bonusValue: v })}
                />
              </div>
            )}
          </div>
        </Section>

        {/* Conditions */}
        <Section icon={Users2} title="Reward conditions" desc="When and how much affiliates can earn.">
          <div className="space-y-1.5">
            <Label>Minimum order</Label>
            <Segmented
              value={cfg.conditions.minOrderType}
              onChange={(v) => upd("conditions", { minOrderType: v })}
              options={[
                { value: "none", label: "None" },
                { value: "amount", label: "By amount" },
                { value: "orders", label: "By # orders" },
              ]}
            />
            {cfg.conditions.minOrderType !== "none" && (
              <Input
                type="number"
                value={cfg.conditions.minOrderValue}
                onChange={(e) => upd("conditions", { minOrderValue: Number(e.target.value) })}
                className="mt-2 w-40"
                placeholder={cfg.conditions.minOrderType === "amount" ? "$ minimum" : "min orders"}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Reward trigger</Label>
            <Segmented
              value={cfg.conditions.trigger}
              onChange={(v) => upd("conditions", { trigger: v })}
              options={[
                { value: "every", label: "Every purchase" },
                { value: "first", label: "First purchase only" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {cfg.conditions.trigger === "custom" && (
              <Input value={cfg.conditions.triggerCustom} onChange={(e) => upd("conditions", { triggerCustom: e.target.value })} className="mt-2" placeholder="Describe the rule" />
            )}
          </div>
          <div className="rounded-lg border border-hairline p-3">
            <Switch checked={cfg.conditions.maxPerAdvocateEnabled} onCheckedChange={(v) => upd("conditions", { maxPerAdvocateEnabled: v })} label="Cap reward per affiliate" description="Maximum total reward each affiliate can earn" />
            {cfg.conditions.maxPerAdvocateEnabled && (
              <Input type="number" value={cfg.conditions.maxPerAdvocate} onChange={(e) => upd("conditions", { maxPerAdvocate: Number(e.target.value) })} className="mt-3 w-40" placeholder="$ cap" />
            )}
          </div>
        </Section>

        {/* Coupon settings (Shopify) */}
        {cfg.reward.kind === "coupon" && (
          <Section icon={Ticket} title="Coupon settings" desc="How the affiliate's discount code behaves in Shopify.">
            <Switch checked={cfg.coupon.expires} onCheckedChange={(v) => upd("coupon", { expires: v })} label="Code expires" description="Use the campaign's expiry date" />
            <div className="space-y-2">
              <Label>Combines with</Label>
              <div className="flex flex-col gap-2">
                <Check label="Product discounts" checked={cfg.coupon.combineProduct} onChange={(v) => upd("coupon", { combineProduct: v })} />
                <Check label="Order discounts" checked={cfg.coupon.combineOrder} onChange={(v) => upd("coupon", { combineOrder: v })} />
                <Check label="Shipping discounts" checked={cfg.coupon.combineShipping} onChange={(v) => upd("coupon", { combineShipping: v })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Applies to</Label>
              <Segmented
                value={cfg.coupon.appliesTo}
                onChange={(v) => upd("coupon", { appliesTo: v })}
                options={[
                  { value: "all", label: "All products" },
                  { value: "collections", label: "Certain collections" },
                ]}
              />
              {cfg.coupon.appliesTo === "collections" && (
                <Input value={cfg.coupon.collections} onChange={(e) => upd("coupon", { collections: e.target.value })} className="mt-2" placeholder="collection-handle-1, collection-handle-2" />
              )}
            </div>
          </Section>
        )}

        {/* Friend offer */}
        <Section icon={Sparkles} title="Friend offer" desc="What the customer gets when they use the affiliate's code or link.">
          <Segmented
            value={cfg.friend.kind}
            onChange={(v) => upd("friend", { kind: v })}
            options={[
              { value: "coupon", label: "Amount-off coupon" },
              { value: "promo", label: "Promo link" },
              { value: "none", label: "Nothing" },
            ]}
          />
          {cfg.friend.kind === "coupon" && (
            <>
              <div className="space-y-1.5">
                <Label>Discount</Label>
                <ValueInput
                  valueType={cfg.friend.valueType}
                  onTypeChange={(v) => upd("friend", { valueType: v })}
                  value={cfg.friend.value}
                  onValueChange={(v) => upd("friend", { value: v })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Minimum order (optional)</Label>
                <Input type="number" value={cfg.friend.minOrder} onChange={(e) => upd("friend", { minOrder: Number(e.target.value) })} className="w-40" placeholder="$0" />
              </div>
            </>
          )}
          {cfg.friend.kind === "promo" && (
            <>
              <div className="space-y-1.5">
                <Label>Reward description</Label>
                <Textarea value={cfg.friend.promoDescription} onChange={(e) => upd("friend", { promoDescription: e.target.value })} placeholder="e.g. Free gift with your first order — code already applied" />
              </div>
              <div className="space-y-1.5">
                <Label>Promo URL</Label>
                <Input value={cfg.friend.promoUrl} onChange={(e) => upd("friend", { promoUrl: e.target.value })} placeholder="https://syruvia.com/promo" />
              </div>
              <Switch checked={cfg.friend.promoExpires} onCheckedChange={(v) => upd("friend", { promoExpires: v })} label="Promo expires" description="Ends with the campaign" />
            </>
          )}
        </Section>

        {/* Payout */}
        <Section icon={Wallet} title="Payouts" desc="How affiliates in this campaign get paid.">
          <Segmented
            value={cfg.payout.mode}
            onChange={(v) => upd("payout", { mode: v })}
            options={[
              { value: "automatic", label: "Automatic (PayPal)" },
              { value: "manual", label: "Manual" },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {cfg.payout.mode === "automatic"
              ? "Approved commissions are paid in scheduled PayPal batches."
              : "You run payouts manually from the Payouts page."}
          </p>
        </Section>

        <div className="flex justify-end border-t border-hairline pt-5">
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save rewards &amp; rules
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
