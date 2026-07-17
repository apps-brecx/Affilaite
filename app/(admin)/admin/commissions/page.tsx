import { Receipt, Clock, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CommissionsTable } from "@/components/admin/commissions-table";
import { PayNowButton } from "@/components/admin/pay-now-button";
import { listCommissions, listUnattributedAffiliateOrders } from "@/lib/queries";
import { formatCurrency, relativeTime } from "@/lib/utils";

export const metadata = { title: "Commissions" };

export default async function CommissionsPage() {
  const [commissions, unattributed] = await Promise.all([
    listCommissions(),
    listUnattributedAffiliateOrders(),
  ]);
  const sum = (s: string) =>
    commissions.filter((c) => c.status === s).reduce((a, c) => a + c.amount, 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Commission ledger" description="Every earned commission — review, approve, or reverse.">
        <PayNowButton />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Pending" value={sum("pending")} icon={Clock} accent="warning" />
        <StatCard label="Approved" value={sum("approved")} icon={CheckCircle2} accent="success" />
        <StatCard label="Paid" value={sum("paid")} icon={Receipt} accent="primary" />
        <StatCard label="Reversed" value={sum("reversed")} icon={RotateCcw} accent="danger" />
      </div>

      <CommissionsTable commissions={commissions} />

      {unattributed.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-amber-500" />
              Affiliate orders that didn’t earn a commission
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              These orders used an affiliate code or link but weren’t attributed. Here’s why.
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Order</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Why not attributed</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="pr-6 text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unattributed.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6 font-medium">{o.orderNumber}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.discountCodesUsed.length ? (
                        <span className="font-mono text-xs">{o.discountCodesUsed.join(", ")}</span>
                      ) : (
                        "link"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="warning" className="whitespace-normal text-xs font-normal">
                        {o.attributionStatus ?? "not attributed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="tnum">{formatCurrency(o.total)}</TableCell>
                    <TableCell className="pr-6 text-right text-xs text-muted-foreground">
                      {relativeTime(o.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
