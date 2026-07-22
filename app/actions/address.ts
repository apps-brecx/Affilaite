"use server";

import { searchAddresses, type AddressSuggestion } from "@/lib/geocode";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Address type-ahead used by the signup and settings forms. Public (the apply /
 * join pages are unauthenticated), so it's rate-limited per IP. Fails soft —
 * returns [] on any error so the form falls back to manual entry.
 */
export async function suggestAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = (query ?? "").trim();
  if (q.length < 3) return [];
  const ip = await clientIp();
  if (!rateLimit(`addr:${ip}`, 40, 60_000).ok) return [];
  return searchAddresses(q);
}
