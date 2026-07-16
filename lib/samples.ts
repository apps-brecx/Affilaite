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
}): Promise<string> {
  const note = `Affiliate sample for ${opts.affiliateName}${opts.address ? `\nShip to:\n${opts.address}` : ""}`;
  const input = {
    lineItems: [{ title: opts.productTitle || "Product sample", quantity: 1, originalUnitPrice: "0.00" }],
    note,
    tags: ["affiliate-sample"],
  };
  const json = await shopifyGraphQL<any>(DRAFT_CREATE, { input });
  if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join(", "));
  const errs = json.data?.draftOrderCreate?.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join(", "));
  const id = json.data?.draftOrderCreate?.draftOrder?.id;
  if (!id) throw new Error("Shopify did not return a draft order id");
  return id as string;
}
