import { auth } from "@/lib/auth";
import { approvedAffiliateId } from "@/lib/session";
import { shopifyReady } from "@/lib/integrations";
import { uploadImageToShopify, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from "@/lib/uploads";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** Shared image-upload endpoint for the landing-page builder (logo/hero/product/…). */
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) return json(401, "Sign in to upload.");
  // Admins (editing the brand default) and approved affiliates (their own page) only.
  const isAdmin = user.role === "admin";
  const affiliateId = isAdmin ? null : await approvedAffiliateId();
  if (!isAdmin && !affiliateId) return json(403, "Your account isn't active.");

  const who = isAdmin ? `admin:${user.id}` : `aff:${affiliateId}`;
  if (!rateLimit(`upload:${who}`, 40, 60 * 60_000).ok) return json(429, "Too many uploads — try again later.");

  if (!(await shopifyReady())) return json(503, "Connect your Shopify store to upload images.");

  let file: File | null = null;
  try {
    const form = await req.formData();
    file = form.get("file") as File | null;
  } catch {
    return json(400, "Invalid upload.");
  }
  if (!file || typeof file.arrayBuffer !== "function") return json(400, "No file provided.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return json(415, "Use a PNG, JPG, WEBP or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) return json(413, "Image is too large (max 5 MB).");

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const url = await uploadImageToShopify(bytes, file.name || "image", file.type);
    return Response.json({ url });
  } catch (e: any) {
    console.error("[upload:folp-image]", e);
    return json(502, e?.message ? String(e.message) : "Upload failed.");
  }
}

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}
