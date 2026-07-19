// lib/messaging.ts — data layer for the WhatsApp-style groups + DM system.
import { db } from "@/db";
import {
  groups,
  groupMembers,
  groupMessages,
  groupMessageReads,
  pollVotes,
  directMessages,
  affiliates,
  users,
  commissions,
  campaigns,
  affiliateCampaigns,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull, sql, gte, lte } from "drizzle-orm";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export type MessageKind = "text" | "deal" | "invite" | "giveaway" | "competition" | "announcement" | "poll";

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  avatarEmoji: string;
  avatarColor: string;
  imageUrl: string | null;
  visibility: "public" | "private";
  isMain: boolean;
  memberCount: number;
  lastMessage: { preview: string; kind: string; createdAt: string } | null;
  unread: number; // affiliate view
  joined: boolean; // affiliate view
}

export interface ChatMessage {
  id: string;
  kind: MessageKind;
  body: string | null;
  attachments: { type: string; url: string; name?: string }[];
  poll: { question: string; options: { text: string; votes: number }[]; totalVotes: number } | null;
  payload: Record<string, any> | null;
  senderName: string | null;
  createdAt: string;
  readCount: number;
  readers: string[];
  myVote: number | null;
  entered: boolean; // giveaway
}

export interface GroupMemberRow {
  affiliateId: string;
  name: string;
  email: string;
  status: string;
  joinedAt: string | null;
}

export interface DmThreadSummary {
  affiliateId: string;
  name: string;
  email: string;
  lastMessage: { preview: string; fromAdmin: boolean; createdAt: string } | null;
  unread: number; // unread-by-admin
}

export interface DmMessage {
  id: string;
  fromAdmin: boolean;
  body: string | null;
  kind: MessageKind;
  payload: Record<string, any> | null;
  createdAt: string;
  seenByAffiliate: boolean;
}

export interface LeaderRow {
  affiliateId: string;
  name: string;
  value: number;
  rank: number;
}

function pollTally(poll: any, votes: { optionIndex: number }[]) {
  if (!poll?.options) return null;
  const counts = poll.options.map((_: string, i: number) => votes.filter((v) => v.optionIndex === i).length);
  return {
    question: poll.question,
    options: poll.options.map((text: string, i: number) => ({ text, votes: counts[i] })),
    totalVotes: votes.length,
  };
}

function avatar(g: typeof groups.$inferSelect) {
  return {
    avatarEmoji: g.avatarEmoji ?? "💬",
    avatarColor: g.avatarColor ?? "emerald",
    imageUrl: g.imageUrl ?? null,
  };
}

function preview(m: { body: string | null; kind: string | null; poll: any }): string {
  if (m.kind === "deal") return "🎟️ Deal";
  if (m.kind === "invite") return "🚀 Campaign invite";
  if (m.kind === "giveaway") return "🎁 Giveaway";
  if (m.kind === "competition") return "🏆 Competition";
  if (m.kind === "announcement") return "📣 " + (m.body ?? "Announcement");
  if (m.poll) return "📊 " + (m.poll.question ?? "Poll");
  return (m.body ?? "").slice(0, 80) || "Attachment";
}

// ---------------- Admin ----------------

export async function listGroupsAdmin(): Promise<GroupSummary[]> {
  if (!db) return [];
  const gs = await db.select().from(groups).orderBy(desc(groups.isMain), groups.name);
  if (!gs.length) return [];
  const ids = gs.map((g) => g.id);
  const counts = await db
    .select({ groupId: groupMembers.groupId, c: sql<number>`count(*)` })
    .from(groupMembers)
    .where(inArray(groupMembers.groupId, ids))
    .groupBy(groupMembers.groupId);
  const countMap = new Map(counts.map((r) => [r.groupId, Number(r.c)]));
  // Last message per group.
  const lastRows = await db
    .select({ groupId: groupMessages.groupId, body: groupMessages.body, kind: groupMessages.kind, poll: groupMessages.poll, createdAt: groupMessages.createdAt })
    .from(groupMessages)
    .where(inArray(groupMessages.groupId, ids))
    .orderBy(desc(groupMessages.createdAt));
  const lastMap = new Map<string, (typeof lastRows)[number]>();
  for (const r of lastRows) if (!lastMap.has(r.groupId)) lastMap.set(r.groupId, r);

  return gs.map((g) => {
    const last = lastMap.get(g.id);
    return {
      id: g.id,
      name: g.name,
      description: g.description ?? null,
      ...avatar(g),
      visibility: g.visibility,
      isMain: g.isMain,
      memberCount: countMap.get(g.id) ?? 0,
      lastMessage: last
        ? { preview: preview(last), kind: last.kind ?? "text", createdAt: iso(last.createdAt)! }
        : null,
      unread: 0,
      joined: true,
    };
  });
}

export async function getGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  if (!db) return [];
  const rows = await db
    .select({ affiliateId: affiliates.id, name: users.name, email: users.email, status: affiliates.status, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(affiliates, eq(groupMembers.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(desc(groupMembers.joinedAt));
  return rows.map((r) => ({
    affiliateId: r.affiliateId,
    name: r.name ?? r.email ?? "Unknown",
    email: r.email ?? "",
    status: r.status,
    joinedAt: iso(r.joinedAt),
  }));
}

/** Approved affiliates not currently in the group (for the "add members" picker). */
export async function listAddableAffiliates(groupId: string): Promise<{ id: string; name: string; email: string }[]> {
  if (!db) return [];
  const inGroup = await db.select({ id: groupMembers.affiliateId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  const excluded = inGroup.map((r) => r.id);
  const rows = await db
    .select({ id: affiliates.id, name: users.name, email: users.email })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(affiliates.status, "approved"))
    .orderBy(users.name);
  return rows.filter((r) => !excluded.includes(r.id)).map((r) => ({ id: r.id, name: r.name ?? r.email ?? "Unknown", email: r.email ?? "" }));
}

/** Admin thread for a group — full message list with read receipts + poll/giveaway tallies. */
export async function getGroupThreadAdmin(groupId: string): Promise<ChatMessage[]> {
  if (!db) return [];
  const msgs = await db
    .select({ m: groupMessages, senderName: users.name })
    .from(groupMessages)
    .leftJoin(users, eq(groupMessages.senderId, users.id))
    .where(eq(groupMessages.groupId, groupId))
    .orderBy(groupMessages.createdAt);
  if (!msgs.length) return [];
  const ids = msgs.map((r) => r.m.id);
  const reads = await db
    .select({ messageId: groupMessageReads.messageId, name: users.name, email: users.email })
    .from(groupMessageReads)
    .leftJoin(affiliates, eq(groupMessageReads.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(inArray(groupMessageReads.messageId, ids));
  const votes = await db.select().from(pollVotes).where(inArray(pollVotes.messageId, ids));
  const readsByMsg = new Map<string, string[]>();
  for (const r of reads) {
    const arr = readsByMsg.get(r.messageId) ?? [];
    arr.push(r.name ?? r.email ?? "Someone");
    readsByMsg.set(r.messageId, arr);
  }
  return msgs.map(({ m, senderName }) => {
    const readers = readsByMsg.get(m.id) ?? [];
    return {
      id: m.id,
      kind: (m.kind ?? "text") as MessageKind,
      body: m.body ?? null,
      attachments: (m.attachments as any) ?? [],
      poll: pollTally(m.poll, votes.filter((v) => v.messageId === m.id)),
      payload: (m.payload as any) ?? null,
      senderName: senderName ?? "Admin",
      createdAt: iso(m.createdAt)!,
      readCount: readers.length,
      readers,
      myVote: null,
      entered: false,
    };
  });
}

export async function listDmThreads(): Promise<DmThreadSummary[]> {
  if (!db) return [];
  const affs = await db
    .select({ id: affiliates.id, name: users.name, email: users.email })
    .from(affiliates)
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(affiliates.status, "approved"));
  const last = await db
    .select({ affiliateId: directMessages.affiliateId, body: directMessages.body, kind: directMessages.kind, fromAdmin: directMessages.fromAdmin, createdAt: directMessages.createdAt, readByAdminAt: directMessages.readByAdminAt })
    .from(directMessages)
    .orderBy(desc(directMessages.createdAt));
  const lastByAff = new Map<string, (typeof last)[number]>();
  const unreadByAff = new Map<string, number>();
  for (const m of last) {
    if (!lastByAff.has(m.affiliateId)) lastByAff.set(m.affiliateId, m);
    if (!m.fromAdmin && !m.readByAdminAt) unreadByAff.set(m.affiliateId, (unreadByAff.get(m.affiliateId) ?? 0) + 1);
  }
  return affs
    .map((a) => {
      const lm = lastByAff.get(a.id);
      return {
        affiliateId: a.id,
        name: a.name ?? a.email ?? "Unknown",
        email: a.email ?? "",
        lastMessage: lm ? { preview: preview({ body: lm.body, kind: lm.kind, poll: null }), fromAdmin: lm.fromAdmin, createdAt: iso(lm.createdAt)! } : null,
        unread: unreadByAff.get(a.id) ?? 0,
      };
    })
    .sort((a, b) => {
      const at = a.lastMessage?.createdAt ?? "";
      const bt = b.lastMessage?.createdAt ?? "";
      return bt.localeCompare(at);
    });
}

export async function getDmThread(affiliateId: string, viewer: "admin" | "affiliate"): Promise<DmMessage[]> {
  if (!db) return [];
  const rows = await db.select().from(directMessages).where(eq(directMessages.affiliateId, affiliateId)).orderBy(directMessages.createdAt);
  return rows.map((m) => ({
    id: m.id,
    fromAdmin: m.fromAdmin,
    body: m.body ?? null,
    kind: (m.kind ?? "text") as MessageKind,
    payload: (m.payload as any) ?? null,
    createdAt: iso(m.createdAt)!,
    seenByAffiliate: !!m.readByAffiliateAt,
  }));
}

// ---------------- Affiliate ----------------

export async function listGroupsForAffiliate(affiliateId: string): Promise<{ joined: GroupSummary[]; discover: GroupSummary[] }> {
  if (!db) return { joined: [], discover: [] };
  const memberships = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.affiliateId, affiliateId));
  const joinedIds = new Set(memberships.map((m) => m.groupId));
  const gs = await db.select().from(groups).orderBy(desc(groups.isMain), groups.name);
  const ids = gs.map((g) => g.id);
  const counts = ids.length
    ? await db.select({ groupId: groupMembers.groupId, c: sql<number>`count(*)` }).from(groupMembers).where(inArray(groupMembers.groupId, ids)).groupBy(groupMembers.groupId)
    : [];
  const countMap = new Map(counts.map((r) => [r.groupId, Number(r.c)]));
  // Last message + unread per joined group.
  const lastRows = ids.length
    ? await db.select({ groupId: groupMessages.groupId, id: groupMessages.id, body: groupMessages.body, kind: groupMessages.kind, poll: groupMessages.poll, createdAt: groupMessages.createdAt }).from(groupMessages).where(inArray(groupMessages.groupId, ids)).orderBy(desc(groupMessages.createdAt))
    : [];
  const lastMap = new Map<string, (typeof lastRows)[number]>();
  const totalByGroup = new Map<string, number>();
  for (const r of lastRows) {
    if (!lastMap.has(r.groupId)) lastMap.set(r.groupId, r);
    totalByGroup.set(r.groupId, (totalByGroup.get(r.groupId) ?? 0) + 1);
  }
  const myReads = await db.select({ messageId: groupMessageReads.messageId }).from(groupMessageReads).where(eq(groupMessageReads.affiliateId, affiliateId));
  const readIds = new Set(myReads.map((r) => r.messageId));
  const readCountByGroup = new Map<string, number>();
  for (const r of lastRows) if (readIds.has(r.id)) readCountByGroup.set(r.groupId, (readCountByGroup.get(r.groupId) ?? 0) + 1);

  const toSummary = (g: typeof gs[number], joined: boolean): GroupSummary => {
    const last = lastMap.get(g.id);
    const unread = joined ? Math.max(0, (totalByGroup.get(g.id) ?? 0) - (readCountByGroup.get(g.id) ?? 0)) : 0;
    return {
      id: g.id,
      name: g.name,
      description: g.description ?? null,
      ...avatar(g),
      visibility: g.visibility,
      isMain: g.isMain,
      memberCount: countMap.get(g.id) ?? 0,
      lastMessage: last ? { preview: preview(last), kind: last.kind ?? "text", createdAt: iso(last.createdAt)! } : null,
      unread,
      joined,
    };
  };

  const joined = gs.filter((g) => joinedIds.has(g.id)).map((g) => toSummary(g, true));
  // Discover: public groups they're not in.
  const discover = gs.filter((g) => !joinedIds.has(g.id) && g.visibility === "public").map((g) => toSummary(g, false));
  return { joined, discover };
}

/** Affiliate thread — only if they're a member. Includes their poll vote + giveaway entry. */
export async function getGroupThreadForAffiliate(groupId: string, affiliateId: string): Promise<ChatMessage[] | null> {
  if (!db) return [];
  const member = await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.affiliateId, affiliateId)) });
  if (!member) return null; // not a member → no access
  const msgs = await db
    .select({ m: groupMessages, senderName: users.name })
    .from(groupMessages)
    .leftJoin(users, eq(groupMessages.senderId, users.id))
    .where(eq(groupMessages.groupId, groupId))
    .orderBy(groupMessages.createdAt);
  if (!msgs.length) return [];
  const ids = msgs.map((r) => r.m.id);
  const votes = await db.select().from(pollVotes).where(inArray(pollVotes.messageId, ids));
  const myVotes = new Map(votes.filter((v) => v.affiliateId === affiliateId).map((v) => [v.messageId, v.optionIndex]));
  return msgs.map(({ m, senderName }) => ({
    id: m.id,
    kind: (m.kind ?? "text") as MessageKind,
    body: m.body ?? null,
    attachments: (m.attachments as any) ?? [],
    poll: pollTally(m.poll, votes.filter((v) => v.messageId === m.id)),
    payload: (m.payload as any) ?? null,
    senderName: senderName ?? "Admin",
    createdAt: iso(m.createdAt)!,
    readCount: 0,
    readers: [],
    myVote: myVotes.has(m.id) ? myVotes.get(m.id)! : null,
    entered: myVotes.has(m.id), // for giveaways, a vote == an entry
  }));
}

// ---------------- Competitions (live leaderboard) ----------------

/** Leaderboard by earned commission (approved+paid+pending, excl. reversed) in a window. */
export async function competitionLeaderboard(startsAt: string | null, endsAt: string | null, metric: "sales" | "revenue" = "sales"): Promise<LeaderRow[]> {
  if (!db) return [];
  const conds = [sql`${commissions.status} not in ('reversed','rejected')`, sql`${commissions.amount} >= 0`];
  if (startsAt) conds.push(gte(commissions.createdAt, new Date(startsAt)));
  if (endsAt) conds.push(lte(commissions.createdAt, new Date(endsAt)));
  const rows = await db
    .select({
      affiliateId: commissions.affiliateId,
      name: users.name,
      email: users.email,
      value: metric === "revenue" ? sql<string>`coalesce(sum(${commissions.amount}),0)` : sql<number>`count(*)`,
    })
    .from(commissions)
    .leftJoin(affiliates, eq(commissions.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(and(...conds))
    .groupBy(commissions.affiliateId, users.name, users.email)
    .orderBy(desc(metric === "revenue" ? sql`coalesce(sum(${commissions.amount}),0)` : sql`count(*)`))
    .limit(10);
  return rows
    .filter((r) => r.affiliateId)
    .map((r, i) => ({ affiliateId: r.affiliateId!, name: r.name ?? r.email ?? "Unknown", value: num(r.value), rank: i + 1 }));
}
