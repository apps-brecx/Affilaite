import { User, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/affiliate/profile-form";
import { NotificationPrefs } from "@/components/affiliate/notification-prefs";
import { requireAffiliate } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireAffiliate();
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage your profile, social channels, and notifications." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4 text-primary" /> Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm me={me} />
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4 text-primary" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <NotificationPrefs prefs={me.notificationPrefs} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
