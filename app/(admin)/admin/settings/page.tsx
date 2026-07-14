import Link from "next/link";
import { Layers, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DefaultDestination } from "@/components/admin/default-destination";
import { dataSource, getDefaultDestination } from "@/lib/queries";

export const metadata = { title: "Settings · General" };

export default async function GeneralSettingsPage() {
  const defaultDestination = await getDefaultDestination();
  return (
    <div className="space-y-8">
      <PageHeader title="General" description="Program-wide defaults and links.">
        <Badge variant={dataSource === "live" ? "success" : "warning"}>
          {dataSource === "live" ? "Live database" : "Database not connected"}
        </Badge>
      </PageHeader>

      <DefaultDestination value={defaultDestination} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 text-primary" /> Program defaults
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Commission rate, cookie window, hold period and payout minimum are managed per program under{" "}
            <Link href="/admin/programs" className="font-medium text-primary hover:underline">Programs</Link>. Per-campaign
            rewards live on each campaign's <strong>Rewards &amp; rules</strong> tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
