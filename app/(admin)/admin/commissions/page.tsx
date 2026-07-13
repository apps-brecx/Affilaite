import { Receipt, Clock, CheckCircle2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { CommissionsTable } from "@/components/admin/commissions-table";
import { listCommissions } from "@/lib/queries";

export const metadata = { title: "Commissions" };

export default async function CommissionsPage() {
  const commissions = await listCommissions();
  const sum = (s: string) =>
    commissions.filter((c) => c.status === s).reduce((a, c) => a + c.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Commission ledger" description="Every earned commission — review, approve, or reverse." />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Pending" value={sum("pending")} icon={Clock} accent="warning" />
        <StatCard label="Approved" value={sum("approved")} icon={CheckCircle2} accent="success" />
        <StatCard label="Paid" value={sum("paid")} icon={Receipt} accent="primary" />
        <StatCard label="Reversed" value={sum("reversed")} icon={RotateCcw} accent="danger" />
      </div>

      <CommissionsTable commissions={commissions} />
    </div>
  );
}
