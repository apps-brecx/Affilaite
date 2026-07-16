import { PageHeader } from "@/components/ui/page-header";
import { AccountSettings } from "@/components/admin/account-settings";
import { currentUser } from "@/lib/session";

export const metadata = { title: "Settings · Account" };

export default async function AccountSettingsPage() {
  const user = await currentUser();
  return (
    <div className="space-y-8">
      <PageHeader title="Account" description="Your administrator profile and password." />
      <AccountSettings name={user?.name ?? "Administrator"} email={user?.email ?? ""} />
    </div>
  );
}
