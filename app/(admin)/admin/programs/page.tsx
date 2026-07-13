import { Plus, Star, Clock, Calendar, Percent, DollarSign, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { listPrograms } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const programs = await listPrograms();
  return (
    <div className="space-y-8">
      <PageHeader title="Programs" description="Commission rulesets. Assign affiliates to a program to set how they earn." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {programs.map((p) => (
          <Card key={p.id} className={p.isDefault ? "border-primary/30 ring-1 ring-primary/10" : ""}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {p.name}
                  {p.isDefault && (
                    <Badge variant="default" className="gap-1">
                      <Star className="size-3" /> Default
                    </Badge>
                  )}
                </CardTitle>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="size-3.5" /> {p.affiliateCount} affiliates
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-2">
                <span className="font-display text-4xl font-semibold tracking-tight text-primary">
                  {p.commissionType === "percent" ? `${p.commissionValue}%` : formatCurrency(p.commissionValue)}
                </span>
                <span className="mb-1.5 text-sm text-muted-foreground">
                  {p.commissionType === "percent" ? "per sale" : "flat per order"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-4 text-sm">
                <Meta icon={Calendar} label="Cookie window" value={`${p.cookieWindowDays} days`} />
                <Meta icon={Clock} label="Hold period" value={`${p.holdDays} days`} />
                <Meta icon={DollarSign} label="Min payout" value={formatCurrency(p.payoutMinimum)} />
                <Meta icon={Percent} label="New customer" value={p.newCustomerOnly ? "Only" : "All"} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Edit</Button>
                {!p.isDefault && <Button variant="ghost" size="sm">Set default</Button>}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Create card */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <Plus className="size-4" /> New program
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. Holiday Partners" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-subtle">
                  <option>Percent</option>
                  <option>Flat</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Value</Label>
                <Input type="number" placeholder="15" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cookie days</Label>
                <Input type="number" placeholder="30" />
              </div>
              <div className="space-y-1.5">
                <Label>Hold days</Label>
                <Input type="number" placeholder="30" />
              </div>
            </div>
            <Switch label="New customers only" />
            <Button className="w-full">Create program</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-0.5 font-medium text-foreground">{value}</p>
    </div>
  );
}
