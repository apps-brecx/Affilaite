import { redirect } from "next/navigation";
import { auth } from "./auth";
import { getAffiliate } from "./queries";
import { canAccessArea } from "./permissions";
import type { Affiliate } from "./types";

export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if ((user as any).role !== "admin") redirect("/dashboard");
  return user;
}

/** Guard a specific admin area at the page level (belt-and-suspenders with the
 * middleware). Redirects owners/permitted through; bounces others to /admin. */
export async function requireArea(area: string) {
  const user = await requireAdmin();
  if (!canAccessArea(user as any, area)) redirect("/admin");
  return user;
}

/** Owner-only guard (team management, etc.). */
export async function requireOwner() {
  const user = await requireAdmin();
  if (!(user as any).isOwner) redirect("/admin");
  return user;
}

/**
 * For server actions (which return a friendly result rather than redirecting):
 * the current affiliate's id ONLY if their account is approved, else null.
 * Page guards bounce suspended/pending affiliates, but the actions they'd call
 * (request a sample, post, vote, join a group, edit their profile) resolve the
 * affiliate straight from the session — so they must re-check status here too,
 * or a direct call sails past the page guard.
 */
export async function approvedAffiliateId(): Promise<string | null> {
  const user = await currentUser();
  const affiliateId = (user as any)?.affiliateId as string | undefined;
  if (!affiliateId) return null;
  const affiliate = await getAffiliate(affiliateId);
  if (!affiliate || affiliate.status !== "approved") return null;
  return affiliateId;
}

/** Resolve the logged-in affiliate, or redirect appropriately. */
export async function requireAffiliate(): Promise<Affiliate> {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const affiliateId = (user as any).affiliateId as string | null;
  if (!affiliateId) {
    // Admins have no affiliate profile — send them to their own area.
    if ((user as any).role === "admin") redirect("/admin");
    redirect("/login");
  }
  const affiliate = await getAffiliate(affiliateId!);
  if (!affiliate) redirect("/login");
  // Only approved affiliates get the portal; pending/suspended/rejected land
  // on a friendly status screen instead of a dashboard with a dead code.
  if (affiliate.status !== "approved") redirect("/pending");
  return affiliate;
}
