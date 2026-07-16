import { Gift, MapPin, Clock, Check, X, Truck, ExternalLink, PackageOpen } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SampleActions } from "@/components/admin/sample-actions";
import { requireAdmin } from "@/lib/session";
import { listSampleRequests } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Samples" };

const STATUS: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger"; icon: typeof Clock }> = {
  requested: { label: "Requested", variant: "warning", icon: Clock },
  approved: { label: "Approved", variant: "success", icon: Check },
  shipped: { label: "Shipped", variant: "success", icon: Truck },
  rejected: { label: "Rejected", variant: "danger", icon: X },
};

export default async function AdminSamplesPage() {
  await requireAdmin();
  const requests = await listSampleRequests();
  const open = requests.filter((r) => r.status === "requested");
  const rest = requests.filter((r) => r.status !== "requested");

  const Row = ({ r }: { r: (typeof requests)[number] }) => {
    const s = STATUS[r.status] ?? STATUS.requested;
    const Icon = s.icon;
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4 sm:flex-row sm:items-center">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {r.productImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.productImage} alt={r.productTitle} className="size-full object-cover" />
          ) : (
            <Gift className="size-5 text-muted-foreground" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-medium">{r.productTitle}</p>
            <Badge variant={s.variant}>
              <Icon className="size-3" /> {s.label}
            </Badge>
            {r.shopifyOrderId && (
              <Badge variant="secondary">
                <PackageOpen className="size-3" /> Draft order
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {r.affiliateName}
            {r.affiliateEmail ? ` · ${r.affiliateEmail}` : ""} · {formatDate(r.createdAt)}
          </p>
          {r.address && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
              <MapPin className="mt-0.5 size-3 shrink-0" />
              <span className="whitespace-pre-line">{r.address}</span>
            </p>
          )}
          {r.note && <p className="mt-1 text-xs italic text-muted-foreground">“{r.note}”</p>}
          {r.productUrl && (
            <a
              href={r.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              View product <ExternalLink className="size-3" />
            </a>
          )}
        </div>
        <SampleActions id={r.id} status={r.status} />
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sample requests"
        description="Review affiliate sample requests. Approving creates a Shopify draft order (when connected) so you can fulfill and ship."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-warning" /> Awaiting review
            {open.length > 0 && <Badge variant="warning">{open.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {open.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No requests waiting for review.</p>
          ) : (
            open.map((r) => <Row key={r.id} r={r} />)
          )}
        </CardContent>
      </Card>

      {rest.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="size-4 text-primary" /> History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rest.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </CardContent>
        </Card>
      )}

      {requests.length === 0 && (
        <EmptyState
          icon={Gift}
          title="No sample requests yet"
          description="When affiliates request product samples, they'll show up here for your review."
        />
      )}
    </div>
  );
}
