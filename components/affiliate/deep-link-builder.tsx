"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/ui/copy-button";
import { buildReferralLink, STORE_URL } from "@/lib/links";

export function DeepLinkBuilder({ refCode }: { refCode: string }) {
  const [url, setUrl] = useState("");
  const target = url.trim() || STORE_URL;
  const built = buildReferralLink(refCode, target);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="deep">Link to any product or collection</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="deep"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={`${STORE_URL}/products/signature-coat`}
              className="pl-9"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-md border border-hairline bg-muted/40 p-2 pl-3">
        <code className="flex-1 truncate font-mono text-xs text-muted-foreground">{built}</code>
        <CopyButton value={built} />
      </div>
    </div>
  );
}
