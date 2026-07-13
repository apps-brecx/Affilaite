import { Megaphone, MailOpen, Clock, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BroadcastComposer } from "@/components/admin/broadcast-composer";
import { listMessages } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  const messages = await listMessages();
  return (
    <div className="space-y-8">
      <PageHeader title="Broadcast messaging" description="Reach your affiliate community with personalized, on-brand emails." />

      <BroadcastComposer />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="size-4 text-primary" /> Sent &amp; scheduled
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-3 rounded-lg border border-hairline p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{m.subject}</p>
                  {m.sentAt ? (
                    <Badge variant="success">Sent</Badge>
                  ) : (
                    <Badge variant="warning"><Clock className="size-3" /> Scheduled</Badge>
                  )}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{m.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-5 text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-3.5" /> {m.recipients}
                </span>
                {m.openRate != null && (
                  <span className="flex items-center gap-1.5 font-medium text-success">
                    <MailOpen className="size-3.5" /> {m.openRate}%
                  </span>
                )}
                <span className="text-muted-foreground">{formatDate(m.sentAt ?? m.scheduledFor)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
