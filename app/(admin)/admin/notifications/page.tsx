import { PageHeader } from "@/components/ui/page-header";
import { EmailCenter } from "@/components/admin/email-center";
import { currentUser } from "@/lib/session";
import { getAllEmailTemplates } from "@/lib/email-center";
import { emailReady } from "@/lib/integrations";

export const metadata = { title: "Notification Center" };

export default async function NotificationCenterPage() {
  const [items, user, ready] = await Promise.all([getAllEmailTemplates(), currentUser(), emailReady()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Notification Center"
        description="Every automatic email your affiliates receive — turn each on or off, rewrite the copy, add a button and a header image, then preview and send yourself a test."
      />

      {!ready && (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
          Resend isn&apos;t connected yet, so emails won&apos;t actually send. Connect it in{" "}
          <a href="/admin/settings/integrations" className="font-medium underline">Settings → Integrations</a> to go live. You can still edit and preview here.
        </div>
      )}

      <EmailCenter items={items} adminEmail={user?.email ?? ""} />
    </div>
  );
}
