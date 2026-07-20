// lib/ai.ts — tiny AI seam for short, human-readable content summaries.
//
// If ANTHROPIC_API_KEY is set we ask Claude for a one-line description of a
// discovered social post; otherwise we fall back to a trimmed version of the
// caption so the feature degrades gracefully with no key configured.

const BRAND = "Syruvia";

function trim(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

/** Heuristic fallback when no LLM key is available. */
function fallbackDescription(caption: string, platform: string, mediaType: string): string {
  const noun = mediaType === "video" ? "video" : mediaType === "image" ? "photo" : "post";
  const cap = trim(caption, 120);
  if (cap) return cap;
  return `${platform[0]?.toUpperCase()}${platform.slice(1)} ${noun} featuring ${BRAND}.`;
}

/**
 * Write a short (≤ ~20 word) description of a piece of affiliate content.
 * Never throws — returns a sensible fallback on any error.
 */
export async function describeContent(input: {
  caption: string;
  platform: string;
  mediaType: string;
}): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  const fallback = fallbackDescription(input.caption, input.platform, input.mediaType);
  if (!key || !input.caption.trim()) return fallback;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: `You summarize influencer posts for the brand ${BRAND}. In one plain sentence (max 20 words, no hashtags, no quotes), describe what this ${input.platform} ${input.mediaType} shows about the brand.\n\nCaption: ${trim(input.caption, 500)}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return fallback;
    const json: any = await res.json();
    const text = json?.content?.[0]?.text?.trim();
    return text ? trim(text, 180) : fallback;
  } catch {
    return fallback;
  }
}
