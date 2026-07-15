import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/lib/nav";
import { requireAdmin } from "@/lib/session";
import { getCatalogNewCounts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const newCounts = await getCatalogNewCounts();
  const badges = newCounts.total ? { "/admin/promotions": newCounts.total } : undefined;

  return (
    <AppShell
      variant="admin"
      sections={adminNav}
      user={{ name: user.name ?? "Administrator", email: user.email ?? "", role: "Administrator" }}
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
