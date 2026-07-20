"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle, Link as LinkIcon, RefreshCw, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { linkShopifyAccount, unlinkShopifyAccount } from "@/app/actions/affiliate";

export function ShopifyLinkCard({
  linked,
  linkedName,
  linkedEmail,
  broken,
  email,
}: {
  linked: boolean;
  linkedName: string | null;
  linkedEmail: string | null;
  broken: boolean; // has a stored id, but it no longer resolves in Shopify
  email: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const run = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.message, res.ok ? "success" : "error");
      if (res.ok) router.refresh();
    });

  return (
    <div className="space-y-4">
      {linked ? (
        <div className="flex items-start gap-3 rounded-xl border border-success/30 bg-success-soft/50 p-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Linked to your Syruvia account</p>
            <p className="truncate text-xs text-muted-foreground">{linkedName ? `${linkedName} · ` : ""}{linkedEmail ?? email}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-xl border border-hairline bg-muted/40 p-3">
          <XCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{broken ? "Link needs attention" : "Not linked yet"}</p>
            <p className="text-xs text-muted-foreground">
              {broken
                ? "Your linked account couldn't be found — re-link to restore your orders & VIP points."
                : `Link your ${email} Syruvia account to see your orders and VIP points here.`}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {linked ? (
          <>
            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(linkShopifyAccount)}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Re-check
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(unlinkShopifyAccount)}>
              <Unlink className="size-4" /> Unlink
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={pending} onClick={() => run(linkShopifyAccount)}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : broken ? <RefreshCw className="size-4" /> : <LinkIcon className="size-4" />}
            {broken ? "Retry link" : "Link my Shopify account"}
          </Button>
        )}
      </div>
    </div>
  );
}
