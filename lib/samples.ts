// lib/samples.ts — create a Shopify draft order for an approved sample.
// A $0 custom line item with the shipping address in the note; the admin
// finishes/ships it from Shopify. (Real order automation can come later.)
import { shopifyGraphQL } from "./shopify";

const DRAFT_CREATE = `
  mutation SampleDraft($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name }
      userErrors { field message }
    }
  }`;

export async function createSampleDraftOrder(opts: {
  productTitle: string;
  affiliateName: string;
  address: string | null;
  sampleId?: string;
}): Promise<string> {
  const note = `Affiliate sample for ${opts.affiliateName}${opts.address ? `\nShip to:\n${opts.address}` : ""}`;
  // Tag with the sample id so the fulfillment webhook can match this order back
  // to the request and auto-mark it shipped. Tags carry to the completed order.
  const tags = ["affiliate-sample", ...(opts.sampleId ? [`sample-${opts.sampleId}`] : [])];
  const input = {
    lineItems: [{ title: opts.productTitle || "Product sample", quantity: 1, originalUnitPrice: "0.00" }],
    note,
    tags,
  };
  const json = await shopifyGraphQL<any>(DRAFT_CREATE, { input });
  if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join(", "));
  const errs = json.data?.draftOrderCreate?.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join(", "));
  const id = json.data?.draftOrderCreate?.draftOrder?.id;
  if (!id) throw new Error("Shopify did not return a draft order id");
  return id as string;
}

// ---------- Shopify fulfillment → auto-mark samples shipped ----------
import { db } from "@/db";
import { sampleRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notify } from "./notifications";

/**
 * Handle an orders/fulfilled (or fulfillments/create) webhook: if the order was
 * tagged `sample-<id>`, mark that sample request shipped and copy the carrier /
 * tracking from the fulfillment. Safe to call for non-sample orders (no-op).
 */
export async function processSampleFulfillment(payload: any): Promise<void> {
  if (!db) return;
  // Tags live on the order; on a fulfillments/create payload the order fields
  // are nested differently, so accept either shape.
  const tagsRaw: string = payload?.tags ?? payload?.order?.tags ?? "";
  const tags = String(tagsRaw).split(",").map((t) => t.trim());
  const sampleTag = tags.find((t) => t.startsWith("sample-"));
  if (!sampleTag) return;
  const sampleId = sampleTag.slice("sample-".length);
  if (!sampleId) return;

  const req = await db.query.sampleRequests.findFirst({ where: eq(sampleRequests.id, sampleId) });
  if (!req || req.status === "shipped") return;

  // Fulfillment/tracking may be on the order (fulfillments[]) or the payload itself.
  const f = payload?.fulfillments?.[0] ?? (payload?.tracking_number ? payload : null);
  const carrier = f?.tracking_company ?? null;
  const trackingNumber = Array.isArray(f?.tracking_numbers) ? f.tracking_numbers[0] : f?.tracking_number ?? null;
  const trackingUrl = Array.isArray(f?.tracking_urls) ? f.tracking_urls[0] : f?.tracking_url ?? null;

  await db
    .update(sampleRequests)
    .set({ status: "shipped", carrier, trackingNumber, trackingUrl, shippedAt: new Date() })
    .where(eq(sampleRequests.id, sampleId));

  const track = trackingNumber ? ` Tracking: ${carrier ? carrier + " " : ""}${trackingNumber}.` : "";
  await notify(req.affiliateId, "samples", "Your sample shipped 📦", `Your ${req.productTitle ?? "sample"} is on its way!${track}`, "/samples");
}
