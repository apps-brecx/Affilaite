"use client";

import { QrCode, Download } from "lucide-react";

/**
 * Referral QR rendered on a solid white tile so it always scans and looks right
 * in both light and dark mode, with a one-click PNG download.
 */
export function QrCard({ png, code }: { png: string; code: string }) {
  const download = () => {
    const a = document.createElement("a");
    a.href = png;
    a.download = `sipfluence-${(code || "qr").toLowerCase()}-qr.png`;
    a.click();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-card p-6">
      {/* Always-white tile — a QR needs a light background to scan reliably. */}
      <div className="rounded-xl bg-white p-3 shadow-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={png} alt="QR code for your referral link" className="size-40" />
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <QrCode className="size-3.5" /> Scan to shop
      </div>
      <button
        type="button"
        onClick={download}
        className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Download className="size-4" /> Download
      </button>
    </div>
  );
}
