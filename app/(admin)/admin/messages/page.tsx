import Link from "next/link";
import { Megaphone, MailOpen, Clock, Users, UsersRound, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { GroupForm } from "@/components/admin/group-form";
import { CreateReveal } from "@/components/admin/create-reveal";
import { listMessages, listAffiliates, listGroups } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Messages & Groups" };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  const { to } = await searchParams;
  const [messages, affiliates, groups] = await Promise.all([listMessages(), listAffiliates(), listGroups()]);
  const countBy = (s: string) => affiliates.filter((a) => a.status === s).length;
  const audiences = [
    { label: "All approved", count: countBy("approved"), status: ["approved"] },
    { label: "Pending applicants", count: countBy("pending"), status: ["pending"] },
    { label: "Everyone", count: affiliates.length, status: ["approved", "pending", "suspended"] },
    ...groups.map((g) => ({ label: g.name, count: g.memberCount, groupIds: [g.id] })),
  ];
  const target = to ? affiliates.find((a) => a.id === to) : undefined;
  return (
    <div className="space-y-8">
      <PageHeader title="Messages & Groups" description="Message your whole community, a group, or a single affiliate — and manage your groups." />

      {/* Everything behind its own button — nothing open by default */}
      <div className="flex flex-wrap gap-2">
        <CreateReveal label="Compose broadcast" defaultOpen={!!target}>
          <div className="pt-2">
            <BroadcastComposer audiences={audiences} defaultAffiliate={target ? { id: target.id, name: target.name } : undefined} />
          </div>
        </CreateReveal>
        <CreateReveal label="New group">
          <div className="max-w-md pt-2"><GroupForm /></div>
        </CreateReveal>
        <CreateReveal label="Message history">
          <Card className="mt-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="size-4 text-primary" /> Sent &amp; scheduled
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {messages.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No broadcasts sent yet.</p>
              )}
              {messages.map((m) => (
                <div key={m.id} className="flex flex-col gap-3 rounded-lg border border-hairline p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{m.subject}</p>
                      {m.sentAt ? <Badge variant="success">Sent</Badge> : <Badge variant="warning"><Clock className="size-3" /> Scheduled</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{m.body}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-5 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="size-3.5" /> {m.recipients}</span>
                    {m.openRate != null && <span className="flex items-center gap-1.5 font-medium text-success"><MailOpen className="size-3.5" /> {m.openRate}%</span>}
                    <span className="text-muted-foreground">{formatDate(m.sentAt ?? m.scheduledFor)}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </CreateReveal>
      </div>

      {/* Groups — the default content of this tab */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <UsersRound className="size-4" /> Groups
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed border-hairline py-10 text-center text-sm text-muted-foreground">
              No groups yet. Create one to segment your affiliates and run group chats.
            </p>
          )}
          {groups.map((g) => {
            const members = affiliates.filter((a) => a.groupId === g.id).slice(0, 5);
            return (
              <Card key={g.id} className="transition-shadow hover:shadow-lift">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><UsersRound className="size-4" /></span>
                    {g.name}
                  </CardTitle>
                  <Badge variant="secondary">{g.memberCount}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{g.description || "No description."}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {members.length === 0 && <span className="text-xs text-muted-foreground">No members yet</span>}
                      {members.map((m) => (
                        <span key={m.id} className="rounded-full ring-2 ring-card"><Avatar name={m.name} size={28} /></span>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/groups/${g.id}`}>Manage <ArrowRight className="size-3.5" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
