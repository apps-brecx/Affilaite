import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GroupManager } from "@/components/admin/group-manager";
import { GroupMessageComposer } from "@/components/admin/group-message-composer";
import { GroupChat } from "@/components/admin/group-chat";
import { getGroup, listAffiliates, getGroupChat } from "@/lib/queries";

export default async function GroupManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = await getGroup(id);
  if (!group) notFound();

  const affiliates = await listAffiliates();
  const members = affiliates.filter((a) => a.groupId === id);
  // Candidates: approved affiliates not already in this group.
  const candidates = affiliates.filter((a) => a.status === "approved" && a.groupId !== id);
  const chat = await getGroupChat(id);

  return (
    <div className="space-y-8">
      <Link href="/admin/groups" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All groups
      </Link>

      <PageHeader
        title={group.name}
        description={group.description || "Segment affiliates for targeted messaging, promotions, and payouts."}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1.5 text-sm text-muted-foreground">
          <UsersRound className="size-4" /> {members.length} member{members.length === 1 ? "" : "s"}
        </span>
      </PageHeader>

      <GroupManager group={group} members={members} candidates={candidates}>
        <GroupMessageComposer groupId={group.id} groupName={group.name} memberCount={members.length} />
      </GroupManager>

      <GroupChat groupId={group.id} memberCount={members.length} messages={chat} />
    </div>
  );
}
