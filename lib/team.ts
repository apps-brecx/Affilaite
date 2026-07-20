// lib/team.ts — admin team roster (server-only data helper).
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  isOwner: boolean;
  permissions: string[];
  createdAt: string;
}

export async function listTeam(): Promise<TeamMember[]> {
  if (!db) return [];
  const rows = await db.select().from(users).where(eq(users.role, "admin")).orderBy(desc(users.isOwner), desc(users.createdAt));
  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name ?? u.email,
    isOwner: !!u.isOwner,
    permissions: Array.isArray(u.permissions) ? (u.permissions as string[]) : [],
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
  }));
}
