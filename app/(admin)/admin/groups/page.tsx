import { UsersRound, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { GroupForm } from "@/components/admin/group-form";
import { listGroups, listAffiliates } from "@/lib/queries";

export const metadata = { title: "Groups" };

export default async function GroupsPage() {
  const [groups, affiliates] = await Promise.all([listGroups(), listAffiliates()]);

  return (
    <div className="space-y-8">
      <PageHeader title="Groups" description="Segment affiliates for targeted messaging, promotions, and payouts." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
          {groups.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-hairline py-10 text-center text-sm text-muted-foreground">
              No groups yet. Create one to segment your affiliates.
            </p>
          )}
          {groups.map((g) => {
            const members = affiliates.filter((a) => a.groupId === g.id).slice(0, 5);
            return (
              <Card key={g.id} className="group transition-shadow hover:shadow-lift">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <UsersRound className="size-4" />
                      </span>
                      {g.name}
                    </CardTitle>
                  </div>
                  <Badge variant="secondary">{g.memberCount}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{g.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {members.map((m) => (
                        <span key={m.id} className="ring-2 ring-card rounded-full">
                          <Avatar name={m.name} size={28} />
                        </span>
                      ))}
                      {g.memberCount > members.length && (
                        <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground ring-2 ring-card">
                          +{g.memberCount - members.length}
                        </span>
                      )}
                    </div>
                    <Button variant="ghost" size="sm">
                      Manage <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <GroupForm />
      </div>
    </div>
  );
}
