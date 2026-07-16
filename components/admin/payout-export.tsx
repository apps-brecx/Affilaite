"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv } from "@/lib/csv";
import type { Payout } from "@/lib/types";

const HEADERS = ["Batch", "PayPal batch ID", "Batch status", "Date", "Affiliate", "Email", "Amount", "Currency", "Item status", "PayPal item ID"];

/** Export every payout line item across all batches as a CSV report. */
export function PayoutExport({ payouts, label = "Export CSV", filename = "payouts.csv" }: { payouts: Payout[]; label?: string; filename?: string }) {
  const download = () => {
    const rows = payouts.flatMap((p) =>
      p.items.length
        ? p.items.map((i) => ({
            Batch: p.senderBatchId,
            "PayPal batch ID": p.paypalBatchId ?? "",
            "Batch status": p.status,
            Date: new Date(p.createdAt).toISOString(),
            Affiliate: i.affiliateName,
            Email: i.affiliateEmail,
            Amount: i.amount.toFixed(2),
            Currency: i.currency,
            "Item status": i.transactionStatus,
            "PayPal item ID": i.paypalItemId ?? "",
          }))
        : [{
            Batch: p.senderBatchId,
            "PayPal batch ID": p.paypalBatchId ?? "",
            "Batch status": p.status,
            Date: new Date(p.createdAt).toISOString(),
            Affiliate: "",
            Email: "",
            Amount: p.totalAmount.toFixed(2),
            Currency: "",
            "Item status": "",
            "PayPal item ID": "",
          }],
    );
    downloadCsv(filename, toCsv(HEADERS, rows));
  };

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download className="size-4" /> {label}
    </Button>
  );
}
