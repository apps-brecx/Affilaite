import { AppShell } from "@/components/shell/app-shell";
import { adminNav } from "@/lib/nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      variant="admin"
      sections={adminNav}
      user={{ name: "Bu — Founder", email: "bu@brecx.com", role: "Administrator" }}
    >
      {children}
    </AppShell>
  );
}
