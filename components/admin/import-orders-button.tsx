"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { DownloadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { importAffiliateOrders } from "@/app/actions/admin";

/** Pulls past Shopify orders that used an affiliate code into the ledger. */
export function ImportOrdersButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const run = () =>
    start(async () => {
      const res = await importAffiliateOrders();
      toast(res.message, res.ok ? "success" : "error");
      router.refresh();
    });

  return (
    <Button variant="ghost" size="sm" onClick={run} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <DownloadCloud className="size-4" />}
      {pending ? "Importing…" : "Import past orders"}
    </Button>
  );
}
