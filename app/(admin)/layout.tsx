import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/lib/nav";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <AppShell
      variant="admin"
      sections={adminNav}
      user={{ name: user.name ?? "Administrator", email: user.email ?? "", role: "Administrator" }}
    >
      {children}
    </AppShell>
  );
}
