import { Megaphone } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PostTracker } from "@/components/affiliate/post-tracker";
import { requireAffiliate } from "@/lib/session";
import { listMyPosts } from "@/lib/social";

export const metadata = { title: "My Posts" };

export default async function PostsPage() {
  const me = await requireAffiliate();
  const posts = await listMyPosts(me.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Posts"
        description="Log every post you share — it helps us feature your content, send you the right samples, and reward top creators."
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <Megaphone className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Tip: the more you post, the more you earn. Keep your{" "}
            <Link href="/settings" className="font-medium text-primary hover:underline">
              link-in-bio page
            </Link>{" "}
            fresh and drop your code in every caption.
          </p>
        </CardContent>
      </Card>

      <PostTracker posts={posts} />
    </div>
  );
}
