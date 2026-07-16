import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/lib/nav";
import { requireAdmin } from "@/lib/session";
import { getAdminNavBadges } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const badges = await getAdminNavBadges();

  return (
    <AppShell
      variant="admin"
      sections={adminNav}
      badges={badges}
      user={{ name: user.name ?? "Administrator", email: user.email ?? "", role: "Administrator" }}
    >
      {children}
    </AppShell>
  );
}
