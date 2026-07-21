"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
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
  campaigns,
  affiliateCampaigns,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { approvedAffiliateId } from "@/lib/session";
import { notify } from "@/lib/notifications";

export type ActionResult = { ok: boolean; message: string };

async function adminId(): Promise<string> {
  const session = await auth();
  const u = session?.user as any;
  if (u?.role !== "admin") throw new Error("Unauthorized");
  // All admin messaging actions live in the "Messages & Groups" area.
  if (!u.isOwner && !(Array.isArray(u.permissions) && u.permissions.includes("messages"))) {
    throw new Error("You don't have access to Messages & Groups.");
  }
  return u?.id ?? "";
}
// Only APPROVED affiliates can act (join groups, DM, vote, enter giveaways,
// join campaigns). A page guard already bounces suspended/pending affiliates,
// but these actions are called directly, so they must re-check status too.
async function myAffiliateId(): Promise<string | null> {
  return approvedAffiliateId();
}

const KINDS = ["text", "deal", "invite", "giveaway", "competition", "announcement", "poll"] as const;
const avatarSchema = {
  avatarEmoji: z.string().max(8).optional(),
  avatarColor: z.enum(["emerald", "gold", "rose", "sky", "violet", "amber"]).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
};

// ---------------- Groups (admin) ----------------

export async function createGroupChat(input: unknown): Promise<ActionResult> {
  await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      name: z.string().min(2, "Enter a group name."),
      description: z.string().optional(),
      visibility: z.enum(["public", "private"]).default("private"),
      ...avatarSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  await db.insert(groups).values({
    name: d.name,
    description: d.description || null,
    visibility: d.visibility,
    avatarEmoji: d.avatarEmoji || "💬",
    avatarColor: d.avatarColor || "emerald",
    imageUrl: d.imageUrl || null,
  });
  revalidatePath("/admin/messages");
  return { ok: true, message: "Group created." };
}

export async function updateGroupChat(id: string, input: unknown): Promise<ActionResult> {
  await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      visibility: z.enum(["public", "private"]).optional(),
      ...avatarSchema,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  const d = parsed.data;
  const set: Record<string, unknown> = {};
  if (d.name !== undefined) set.name = d.name;
  if (d.description !== undefined) set.description = d.description || null;
  if (d.visibility !== undefined) set.visibility = d.visibility;
  if (d.avatarEmoji !== undefined) set.avatarEmoji = d.avatarEmoji || "💬";
  if (d.avatarColor !== undefined) set.avatarColor = d.avatarColor;
  if (d.imageUrl !== undefined) set.imageUrl = d.imageUrl || null;
  if (Object.keys(set).length) await db.update(groups).set(set).where(eq(groups.id, id));
  revalidatePath("/admin/messages");
  return { ok: true, message: "Group updated." };
}

export async function deleteGroupChat(id: string): Promise<ActionResult> {
  await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const g = await db.query.groups.findFirst({ where: eq(groups.id, id) });
  if (!g) return { ok: false, message: "Group not found." };
  if (g.isMain) return { ok: false, message: "The main group can't be deleted." };
  // Clean up children (no cascade on these FKs).
  const msgs = await db.select({ id: groupMessages.id }).from(groupMessages).where(eq(groupMessages.groupId, id));
  const msgIds = msgs.map((m) => m.id);
  if (msgIds.length) {
    await db.delete(pollVotes).where(inArray(pollVotes.messageId, msgIds));
    await db.delete(groupMessageReads).where(inArray(groupMessageReads.messageId, msgIds));
  }
  await db.delete(groupMessages).where(eq(groupMessages.groupId, id));
  await db.delete(groupMembers).where(eq(groupMembers.groupId, id));
  await db.update(affiliates).set({ groupId: null }).where(eq(affiliates.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
  revalidatePath("/admin/messages");
  return { ok: true, message: "Group deleted." };
}

export async function addGroupMembers(groupId: string, affiliateIds: string[]): Promise<ActionResult> {
  await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  if (!affiliateIds.length) return { ok: false, message: "Pick at least one affiliate." };
  await db
    .insert(groupMembers)
    .values(affiliateIds.map((affiliateId) => ({ groupId, affiliateId })))
    .onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.affiliateId] });
  const g = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  await notify(affiliateIds, "community", `Added to ${g?.name ?? "a group"}`, "You've been added to a group — check Community.", "/community");
  revalidatePath("/admin/messages");
  return { ok: true, message: `Added ${affiliateIds.length} member(s).` };
}

export async function removeGroupMember(groupId: string, affiliateId: string): Promise<ActionResult> {
  await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const g = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (g?.isMain) return { ok: false, message: "Members can't leave the main group." };
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.affiliateId, affiliateId)));
  revalidatePath("/admin/messages");
  return { ok: true, message: "Member removed." };
}

// ---------------- Send to a group ----------------

export async function sendGroupChat(groupId: string, input: unknown): Promise<ActionResult> {
  const senderId = await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      kind: z.enum(KINDS).default("text"),
      body: z.string().max(4000).optional().default(""),
      attachments: z.array(z.object({ type: z.string(), url: z.string().url(), name: z.string().optional() })).optional().default([]),
      poll: z.object({ question: z.string().min(1), options: z.array(z.string().min(1)).min(2).max(8) }).nullable().optional(),
      payload: z.record(z.any()).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid message." };
  const d = parsed.data;

  // A giveaway is stored as a single-option poll so entries reuse poll_votes.
  let poll = d.poll ?? null;
  if (d.kind === "giveaway" && !poll) {
    poll = { question: d.payload?.prize ? `🎁 Win: ${d.payload.prize}` : "🎁 Giveaway", options: ["I'm in!"] };
  }
  if (d.kind === "text" && !d.body.trim() && (!d.attachments || !d.attachments.length) && !poll) {
    return { ok: false, message: "Add a message, attachment, or poll." };
  }

  const group = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!group) return { ok: false, message: "Group not found." };

  await db.insert(groupMessages).values({
    groupId,
    senderId,
    kind: d.kind,
    body: d.body.trim() || null,
    attachments: d.attachments && d.attachments.length ? d.attachments : null,
    poll: poll ?? null,
    payload: d.payload ?? null,
  });

  const members = await db.select({ id: groupMembers.affiliateId }).from(groupMembers).where(eq(groupMembers.groupId, groupId));
  const title =
    d.kind === "deal" ? `🎟️ New deal in ${group.name}` :
    d.kind === "invite" ? `🚀 Campaign invite in ${group.name}` :
    d.kind === "giveaway" ? `🎁 Giveaway in ${group.name}` :
    d.kind === "competition" ? `🏆 Competition in ${group.name}` :
    `New message in ${group.name}`;
  await notify(members.map((m) => m.id), "community", title, poll ? poll.question : d.body.slice(0, 80) || "Tap to view", "/community");
  revalidatePath("/admin/messages");
  revalidatePath("/community");
  return { ok: true, message: "Sent." };
}

// ---------------- Direct messages ----------------

export async function sendDirectMessage(affiliateId: string, input: unknown): Promise<ActionResult> {
  const senderId = await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const parsed = z
    .object({
      kind: z.enum(KINDS).default("text"),
      body: z.string().max(4000).optional().default(""),
      payload: z.record(z.any()).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid message." };
  const d = parsed.data;
  if (d.kind === "text" && !d.body.trim()) return { ok: false, message: "Type a message." };
  await db.insert(directMessages).values({ affiliateId, fromAdmin: true, senderId, kind: d.kind, body: d.body.trim() || null, payload: d.payload ?? null });
  const title = d.kind === "deal" ? "🎟️ A deal just for you" : d.kind === "invite" ? "🚀 You're invited" : d.kind === "giveaway" ? "🎁 Giveaway" : "New message";
  await notify(affiliateId, "community", title, d.body.slice(0, 80) || "Tap to view", "/community");
  revalidatePath("/admin/messages");
  revalidatePath("/community");
  return { ok: true, message: "Sent." };
}

export async function markDmReadByAdmin(affiliateId: string): Promise<ActionResult> {
  await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  await db.update(directMessages).set({ readByAdminAt: new Date() }).where(and(eq(directMessages.affiliateId, affiliateId), eq(directMessages.fromAdmin, false)));
  return { ok: true, message: "" };
}

export async function replyDirectMessage(body: string): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  if (!body.trim()) return { ok: false, message: "Type a message." };
  await db.insert(directMessages).values({ affiliateId, fromAdmin: false, body: body.trim(), kind: "text" });
  revalidatePath("/community");
  revalidatePath("/admin/messages");
  return { ok: true, message: "Sent." };
}

export async function markDmReadByAffiliate(): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId || !db) return { ok: false, message: "" };
  await db.update(directMessages).set({ readByAffiliateAt: new Date() }).where(and(eq(directMessages.affiliateId, affiliateId), eq(directMessages.fromAdmin, true)));
  return { ok: true, message: "" };
}

// ---------------- Affiliate: join / read / vote / enter ----------------

export async function joinGroup(groupId: string): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  const g = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (!g) return { ok: false, message: "Group not found." };
  if (g.visibility !== "public") return { ok: false, message: "This group is invite-only." };
  await db.insert(groupMembers).values({ groupId, affiliateId }).onConflictDoNothing({ target: [groupMembers.groupId, groupMembers.affiliateId] });
  revalidatePath("/community");
  return { ok: true, message: `Joined ${g.name}.` };
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  const g = await db.query.groups.findFirst({ where: eq(groups.id, groupId) });
  if (g?.isMain) return { ok: false, message: "You can't leave the main group." };
  await db.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.affiliateId, affiliateId)));
  revalidatePath("/community");
  return { ok: true, message: "Left the group." };
}

export async function markGroupRead(groupId: string): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId || !db) return { ok: false, message: "" };
  const member = await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, groupId), eq(groupMembers.affiliateId, affiliateId)) });
  if (!member) return { ok: false, message: "" };
  const msgs = await db.select({ id: groupMessages.id }).from(groupMessages).where(eq(groupMessages.groupId, groupId));
  if (msgs.length) {
    await db
      .insert(groupMessageReads)
      .values(msgs.map((m) => ({ messageId: m.id, affiliateId })))
      .onConflictDoNothing({ target: [groupMessageReads.messageId, groupMessageReads.affiliateId] });
  }
  return { ok: true, message: "" };
}

export async function voteInPoll(messageId: string, optionIndex: number): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  if (!Number.isInteger(optionIndex) || optionIndex < 0) return { ok: false, message: "Invalid option." };
  const msg = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, messageId) });
  const poll = msg?.poll as { options: string[] } | null;
  if (!msg || !poll?.options || optionIndex >= poll.options.length) return { ok: false, message: "Poll not found." };
  const member = await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, msg.groupId), eq(groupMembers.affiliateId, affiliateId)) });
  if (!member) return { ok: false, message: "You're not in this group." };
  await db
    .insert(pollVotes)
    .values({ messageId, affiliateId, optionIndex })
    .onConflictDoUpdate({ target: [pollVotes.messageId, pollVotes.affiliateId], set: { optionIndex } });
  revalidatePath("/community");
  return { ok: true, message: "Vote recorded." };
}

export async function enterGiveaway(messageId: string): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  const msg = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, messageId) });
  if (!msg || msg.kind !== "giveaway") return { ok: false, message: "Giveaway not found." };
  const member = await db.query.groupMembers.findFirst({ where: and(eq(groupMembers.groupId, msg.groupId), eq(groupMembers.affiliateId, affiliateId)) });
  if (!member) return { ok: false, message: "You're not in this group." };
  await db
    .insert(pollVotes)
    .values({ messageId, affiliateId, optionIndex: 0 })
    .onConflictDoNothing({ target: [pollVotes.messageId, pollVotes.affiliateId] });
  revalidatePath("/community");
  return { ok: true, message: "You're entered! 🎁 Good luck." };
}

export async function pickGiveawayWinner(messageId: string): Promise<ActionResult> {
  const admin = await adminId();
  if (!db) return { ok: false, message: "Database not configured." };
  const msg = await db.query.groupMessages.findFirst({ where: eq(groupMessages.id, messageId) });
  if (!msg || msg.kind !== "giveaway") return { ok: false, message: "Giveaway not found." };
  const entrants = await db
    .select({ affiliateId: pollVotes.affiliateId, name: users.name, email: users.email })
    .from(pollVotes)
    .leftJoin(affiliates, eq(pollVotes.affiliateId, affiliates.id))
    .leftJoin(users, eq(affiliates.userId, users.id))
    .where(eq(pollVotes.messageId, messageId));
  if (!entrants.length) return { ok: false, message: "No entries yet." };
  // Vary the pick by current time without Math.random (unavailable in some paths).
  const seed = messageId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + new Date().getSeconds();
  const winner = entrants[seed % entrants.length];
  const name = winner.name ?? winner.email ?? "a partner";
  await db.insert(groupMessages).values({
    groupId: msg.groupId,
    senderId: admin || null,
    kind: "announcement",
    body: `🎉 The giveaway winner is ${name}! Congrats — we'll be in touch.`,
  });
  await notify(winner.affiliateId, "community", "🎉 You won the giveaway!", "Congrats — we'll be in touch with the details.", "/community");
  revalidatePath("/admin/messages");
  revalidatePath("/community");
  return { ok: true, message: `Winner: ${name}` };
}

export async function joinCampaignFromInvite(campaignId: string): Promise<ActionResult> {
  const affiliateId = await myAffiliateId();
  if (!affiliateId) return { ok: false, message: "Not signed in." };
  if (!db) return { ok: false, message: "Database not configured." };
  const camp = await db.query.campaigns.findFirst({ where: eq(campaigns.id, campaignId) });
  if (!camp) return { ok: false, message: "Campaign not found." };
  if (camp.status !== "active") return { ok: false, message: "This campaign isn't open right now." };

  // Security: only join if this affiliate was actually invited to THIS campaign —
  // otherwise anyone could pass a campaignId and switch to a higher-paying rate.
  // An invite is a DM to them, or a group-chat invite in a group they're in.
  const [dmInvite] = await db
    .select({ id: directMessages.id })
    .from(directMessages)
    .where(and(
      eq(directMessages.affiliateId, affiliateId),
      eq(directMessages.fromAdmin, true),
      eq(directMessages.kind, "invite"),
      sql`${directMessages.payload} ->> 'campaignId' = ${campaignId}`,
    ))
    .limit(1);
  let invited = !!dmInvite;
  if (!invited) {
    const [groupInvite] = await db
      .select({ id: groupMessages.id })
      .from(groupMessages)
      .innerJoin(groupMembers, eq(groupMembers.groupId, groupMessages.groupId))
      .where(and(
        eq(groupMembers.affiliateId, affiliateId),
        eq(groupMessages.kind, "invite"),
        sql`${groupMessages.payload} ->> 'campaignId' = ${campaignId}`,
      ))
      .limit(1);
    invited = !!groupInvite;
  }
  if (!invited) return { ok: false, message: "You don't have an invite to this campaign." };

  // No unique constraint on affiliate_campaigns — guard against a double-join.
  const existing = await db.query.affiliateCampaigns.findFirst({
    where: and(eq(affiliateCampaigns.affiliateId, affiliateId), eq(affiliateCampaigns.campaignId, campaignId)),
  });
  if (!existing) await db.insert(affiliateCampaigns).values({ affiliateId, campaignId });
  // Joining changes the affiliate's effective commission + payout (attribution
  // uses the active campaign's reward), so refresh the pages that show it.
  revalidatePath("/community");
  revalidatePath("/links");
  revalidatePath("/dashboard");
  revalidatePath("/promotions");
  return { ok: true, message: existing ? `You're already in ${camp.name}.` : `Joined ${camp.name}! Your rate now follows this campaign. 🚀` };
}
