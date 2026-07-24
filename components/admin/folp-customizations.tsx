"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, RotateCcw, Loader2, Palette, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { resetAffiliateFolp } from "@/app/actions/admin";
import type { FolpCustomization } from "@/lib/folp-server";

export function FolpCustomizations({ items }: { items: FolpCustomization[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const revert = (c: FolpCustomization) => {
    if (!confirm(`Revert ${c.name}'s landing page to the brand default? Their favorites collection is kept.`)) return;
    setBusy(c.id);
    start(async () => {
      const res = await resetAffiliateFolp(c.id);
      toast(res.message, res.ok ? "success" : "error");
      setBusy(null);
      if (res.ok) router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Affiliate customizations
          <Badge variant="muted">{items.length}</Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Partners who&apos;ve tailored their own page or picked favorites. Revert a page to the brand default if needed.</p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No affiliates have customized their page yet.</p>
        ) : (
          <div className="divide-y divide-hairline">
            {items.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{c.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {c.hasCustomTheme && <Badge variant="secondary" className="gap-1"><Palette className="size-3" /> Custom design</Badge>}
                    {c.favoriteCount > 0 && <Badge variant="secondary" className="gap-1"><Heart className="size-3" /> {c.favoriteCount} favorite{c.favoriteCount === 1 ? "" : "s"}</Badge>}
                    {c.handle && <code className="font-mono text-[11px] text-muted-foreground">/p/{c.handle}</code>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {c.handle && (
                    <a href={`/p/${c.handle}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-background px-3 py-1.5 text-sm font-medium hover:border-primary/40 hover:text-primary">
                      Preview <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  {c.hasCustomTheme && (
                    <Button variant="outline" size="sm" onClick={() => revert(c)} disabled={pending && busy === c.id}>
                      {pending && busy === c.id ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Revert
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
