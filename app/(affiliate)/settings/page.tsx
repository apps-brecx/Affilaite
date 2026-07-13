import { User, AtSign, Instagram, Globe, Bell } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentAffiliate } from "@/lib/queries";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await getCurrentAffiliate();
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage your profile, social channels, and notifications." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-4 text-primary" /> Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <Avatar name={me.name} size={64} />
                <Button variant="outline" size="sm">Change photo</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" defaultValue={me.name} />
                <Field label="Email" defaultValue={me.email} type="email" />
                <Field label="Company (optional)" defaultValue={me.companyName ?? ""} />
                <Field label="Referral code" defaultValue={me.code} disabled />
              </div>
            </CardContent>
          </Card>

          {/* Socials */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AtSign className="size-4 text-primary" /> Social channels
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <IconField icon={Instagram} label="Instagram" placeholder="@yourhandle" defaultValue={me.socialLinks.instagram ?? ""} />
              <IconField icon={Globe} label="Website" placeholder="yoursite.com" defaultValue={me.socialLinks.website ?? ""} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button>Save changes</Button>
          </div>
        </div>

        {/* Notifications */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="size-4 text-primary" /> Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Switch defaultChecked label="New commission" description="When a sale is attributed to you" />
            <Switch defaultChecked label="Payout sent" description="When money is on its way" />
            <Switch defaultChecked label="Program updates" description="Bonuses, promos & news" />
            <Switch label="Weekly digest" description="A Monday recap of your week" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} />
    </div>
  );
}

function IconField({
  icon: Icon,
  label,
  ...props
}: { icon: React.ComponentType<{ className?: string }>; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" {...props} />
      </div>
    </div>
  );
}
