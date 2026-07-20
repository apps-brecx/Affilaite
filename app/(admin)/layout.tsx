import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/lib/nav";
import { requireAdmin } from "@/lib/session";
import { getAdminNavBadges } from "@/lib/queries";
import { filterAdminNav, isOwner } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const badges = await getAdminNavBadges();
  const sections = filterAdminNav(adminNav, user as any);

  return (
    <AppShell
      variant="admin"
      sections={sections}
      badges={badges}
      user={{ name: user.name ?? "Administrator", email: user.email ?? "", role: isOwner(user as any) ? "Owner" : "Team member" }}
    >
      {children}
    </AppShell>
  );
}
