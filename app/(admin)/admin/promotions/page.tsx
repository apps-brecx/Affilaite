import { BadgePercent, Plus, Calendar, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusPill } from "@/components/ui/status-pill";
import { listPromotions } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Promotions" };

export default async function PromotionsPage() {
  const promos = await listPromotions();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotions"
        description="Time-boxed bonus commissions to spark a push — automatically applied on top of standard rates."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {promos.map((p) => (
            <Card key={p.id} className={p.status === "live" ? "border-success/30 ring-1 ring-success/10" : ""}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-gold/10 text-gold ring-gilded">
                    <BadgePercent className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{p.name}</p>
                      <StatusPill status={p.status} />
                    </div>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="size-3.5" /> {formatDate(p.startsAt)} — {formatDate(p.endsAt)} · {p.groupName}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold text-gold">
                    +{p.bonusType === "percent" ? `${p.bonusValue}%` : `$${p.bonusValue}`}
                  </p>
                  <p className="text-xs text-muted-foreground">bonus commission</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Plus className="size-4" /> New promotion
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Black Friday Boost" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bonus %</Label>
                <Input type="number" placeholder="5" />
              </div>
              <div className="space-y-1.5">
                <Label>Audience</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                  <option>All affiliates</option>
                  <option>VIP Creators</option>
                  <option>Social &amp; Video</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Starts</Label>
                <Input type="date" />
              </div>
              <div className="space-y-1.5">
                <Label>Ends</Label>
                <Input type="date" />
              </div>
            </div>
            <Button className="w-full"><Zap className="size-4" /> Launch promotion</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
