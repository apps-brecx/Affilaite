import { Star, Clock, Calendar, Percent, DollarSign, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgramForm, SetDefaultButton, EditProgramButton, DeleteProgramButton } from "@/components/admin/program-form";
import { CreateReveal } from "@/components/admin/create-reveal";
import { listPrograms } from "@/lib/queries";
import { formatCurrency } from "@/lib/utils";

export const metadata = { title: "Programs" };

export default async function ProgramsPage() {
  const programs = await listPrograms();
  return (
    <div className="space-y-8">
      <PageHeader title="Programs" description="Commission rulesets. Assign affiliates to a program to set how they earn." />

      <CreateReveal label="New program">
        <div className="max-w-md">
          <ProgramForm />
        </div>
      </CreateReveal>

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
              <div className="flex flex-wrap gap-2">
                <SetDefaultButton id={p.id} />
                <DeleteProgramButton program={p} />
              </div>
              <EditProgramButton program={p} />
            </CardContent>
          </Card>
        ))}
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
