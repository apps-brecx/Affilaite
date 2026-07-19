import { Download, Image as ImageIcon, FileText, Film, LayoutTemplate, Images } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAssets } from "@/lib/queries";

export const metadata = { title: "Assets" };

const KIND_ICON = {
  banner: LayoutTemplate,
  image: ImageIcon,
  copy: FileText,
  video: Film,
} as const;

export default async function AssetsPage() {
  const assets = await listAssets();
  return (
    <div className="space-y-8">
      <PageHeader
        title="Creative assets"
        description="Brand-approved banners, product shots, and copy — ready to post. Everything is on-brand and up to date."
      />

      {assets.length === 0 && (
        <EmptyState
          icon={Images}
          title="No creatives yet"
          description="Brand assets will show up here as soon as the Sipfluence team adds them. Check back soon."
        />
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {assets.map((a) => {
          const Icon = KIND_ICON[a.kind];
          return (
            <Card key={a.id} className="group overflow-hidden transition-shadow hover:shadow-lift">
              <div
                className="relative flex h-44 items-center justify-center"
                style={{ background: a.gradient }}
              >
                <Icon className="size-10 text-white/70" />
                {a.url && (
                  <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-full items-center justify-center bg-black/30 backdrop-blur-[1px]">
                      <Button variant="secondary" size="sm" asChild>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" download>
                          <Download className="size-4" /> Download
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.dimensions}</p>
                </div>
                <Badge variant="secondary" className="capitalize">{a.kind}</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
