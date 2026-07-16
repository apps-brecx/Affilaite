import { UsersRound, Mail, Inbox, Megaphone } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAffiliate } from "@/lib/session";
import { getGroup, getMessagesForAffiliate, type InboxMessage } from "@/lib/queries";
import { relativeTime, formatDate } from "@/lib/utils";

export const metadata = { title: "Community" };

/** Group label for a message's day: Today / Yesterday / full date. */
function dayLabel(iso: string | null): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  const key = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key(d) === key(now)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return formatDate(iso);
}

function groupByDay(messages: InboxMessage[]): { label: string; items: InboxMessage[] }[] {
  const groups: { label: string; items: InboxMessage[] }[] = [];
  for (const m of messages) {
    const label = dayLabel(m.sentAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(m);
    else groups.push({ label, items: [m] });
  }
  return groups;
}

export default async function CommunityPage() {
  const me = await requireAffiliate();
  const [group, messages] = await Promise.all([
    me.groupId ? getGroup(me.groupId) : Promise.resolve(undefined),
    getMessagesForAffiliate(me),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Community"
        description="Your group and every message from the Sipfluence team — all in one place."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Group */}
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <UsersRound className="size-4" /> Your group
          </h2>
          {group ? (
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-gilded">
                    <UsersRound className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.memberCount} member{group.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                {group.description && (
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <UsersRound className="size-6" />
                You're not in a group yet. When the team adds you to one, it'll show up here — along with any group-only messages.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Messages */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Inbox className="size-4" /> Messages
          </h2>
          {messages.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No messages yet"
              description="Announcements and messages from the Sipfluence team will appear here."
            />
          ) : (
            <div className="space-y-6">
              {groupByDay(messages).map((group) => (
                <div key={group.label} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</span>
                    <span className="h-px flex-1 bg-hairline" />
                  </div>
                  {group.items.map((m) => (
                    <Card key={m.id}>
                      <CardContent className="space-y-2 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Megaphone className="size-4" />
                            </span>
                            <p className="font-medium">{m.subject || "Message"}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {m.scope === "group" && <Badge variant="secondary">Your group</Badge>}
                            {m.sentAt && <span className="text-xs text-muted-foreground">{relativeTime(m.sentAt)}</span>}
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap pl-10 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
