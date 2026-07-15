import { PageHeader } from "@/components/ui/page-header";
import { NotificationsList } from "@/components/affiliate/notifications-list";
import { requireAffiliate } from "@/lib/session";
import { listNotifications } from "@/lib/notifications";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const me = await requireAffiliate();
  const items = await listNotifications(me.id);

  return (
    <div className="space-y-8">
      <PageHeader title="Notifications" description="Everything new across your portal — commissions, payouts, offers, and messages." />
      <NotificationsList initial={items} />
    </div>
  );
}
