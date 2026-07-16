// lib/rate-limit.ts — tiny in-memory fixed-window rate limiter.
// NOTE: per-process only. It blunts brute force / abuse on a single instance;
// for multi-instance horizontal scale, back this with Redis/Upstash.
import { headers } from "next/headers";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic cleanup so the map can't grow without bound.
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  b.count++;
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (server actions / route handlers). */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0]!.trim();
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}
