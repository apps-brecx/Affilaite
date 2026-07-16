// lib/discounts.ts — bulk Shopify discount code creation (throttled).
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { discountCodes } from "@/db/schema";
import { shopifyGraphQL } from "./shopify";

/**
 * A discount code that isn't already taken. `refCode + percent` collides by
 * construction (JOHN@15% and JOHN1@5% both → JOHN15), which would otherwise
 * leave the second affiliate with no code, so we suffix until unique.
 */
export async function uniqueDiscountCode(base: string): Promise<string> {
  const root = base.toUpperCase();
  if (!db) return root;
  const taken = async (c: string) => Boolean(await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, c) }));
  if (!(await taken(root))) return root;
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
}

const CREATE_CODE = `
  mutation Create($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

export interface DiscountOptions {
  valueType?: "percent" | "fixed";
  minimumSubtotal?: number; // require an order subtotal
  endsAt?: string | null; // ISO expiry
  combinesWith?: { productDiscounts?: boolean; orderDiscounts?: boolean; shippingDiscounts?: boolean };
  collectionIds?: string[]; // gid://shopify/Collection/... — limits the discount to these
}

/**
 * Create an affiliate discount code in Shopify, honoring the campaign's coupon
 * rules (value type, minimum, expiry, combines-with, applies-to collections).
 */
export async function createDiscountForAffiliate(
  code: string,
  value: number,
  options: DiscountOptions = {},
): Promise<string> {
  const items =
    options.collectionIds && options.collectionIds.length
      ? { collections: { add: options.collectionIds } }
      : { all: true };

  const rewardValue =
    options.valueType === "fixed"
      ? { discountAmount: { amount: value, appliesOnEachItem: false } }
      : { percentage: value / 100 };

  const basicCodeDiscount: Record<string, unknown> = {
    title: `Affiliate ${code}`,
    code,
    startsAt: new Date().toISOString(),
    customerSelection: { all: true },
    customerGets: { value: rewardValue, items },
    appliesOncePerCustomer: false,
  };

  if (options.endsAt) basicCodeDiscount.endsAt = options.endsAt;
  if (options.minimumSubtotal && options.minimumSubtotal > 0) {
    basicCodeDiscount.minimumRequirement = {
      subtotal: { greaterThanOrEqualToSubtotal: options.minimumSubtotal },
    };
  }
  if (options.combinesWith) {
    basicCodeDiscount.combinesWith = {
      productDiscounts: !!options.combinesWith.productDiscounts,
      orderDiscounts: !!options.combinesWith.orderDiscounts,
      shippingDiscounts: !!options.combinesWith.shippingDiscounts,
    };
  }

  const json = await shopifyGraphQL<any>(CREATE_CODE, { basicCodeDiscount });
  const errs = json.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join(", "));
  return json.data.discountCodeBasicCreate.codeDiscountNode.id;
}

const UPDATE_CODE = `
  mutation Update($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

const DELETE_CODE = `
  mutation Delete($id: ID!) {
    discountCodeDelete(id: $id) {
      deletedCodeDiscountId
      userErrors { field message }
    }
  }`;

const ACTIVATE_CODE = `
  mutation Activate($id: ID!) {
    discountCodeActivate(id: $id) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

const DEACTIVATE_CODE = `
  mutation Deactivate($id: ID!) {
    discountCodeDeactivate(id: $id) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

function throwOnErrors(errs: any[]) {
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join(", "));
}

/** Update an existing Shopify discount's code and/or percentage. */
export async function updateDiscountInShopify(
  shopifyDiscountId: string,
  changes: { code?: string; value?: number; valueType?: "percent" | "fixed" },
): Promise<void> {
  const basicCodeDiscount: Record<string, unknown> = {};
  if (changes.code) {
    basicCodeDiscount.title = `Affiliate ${changes.code}`;
    basicCodeDiscount.code = changes.code;
  }
  if (typeof changes.value === "number") {
    basicCodeDiscount.customerGets = {
      value:
        changes.valueType === "fixed"
          ? { discountAmount: { amount: changes.value, appliesOnEachItem: false } }
          : { percentage: changes.value / 100 },
    };
  }
  const json = await shopifyGraphQL<any>(UPDATE_CODE, { id: shopifyDiscountId, basicCodeDiscount });
  throwOnErrors(json.data?.discountCodeBasicUpdate?.userErrors);
}

/** Permanently delete a Shopify discount. */
export async function deleteDiscountInShopify(shopifyDiscountId: string): Promise<void> {
  const json = await shopifyGraphQL<any>(DELETE_CODE, { id: shopifyDiscountId });
  throwOnErrors(json.data?.discountCodeDelete?.userErrors);
}

/** Activate or deactivate a Shopify discount without deleting it. */
export async function setDiscountActiveInShopify(shopifyDiscountId: string, active: boolean): Promise<void> {
  const json = await shopifyGraphQL<any>(active ? ACTIVATE_CODE : DEACTIVATE_CODE, { id: shopifyDiscountId });
  throwOnErrors(json.data?.[active ? "discountCodeActivate" : "discountCodeDeactivate"]?.userErrors);
}

/** Translate a campaign config into Shopify discount options. */
export function discountOptionsFromConfig(config: any, endsAt?: string | null): DiscountOptions {
  const c = config?.coupon ?? {};
  const r = config?.reward ?? {};
  const cond = config?.conditions ?? {};
  return {
    valueType: r.valueType === "fixed" ? "fixed" : "percent",
    minimumSubtotal: cond.minOrderType === "amount" ? Number(cond.minOrderValue) || 0 : 0,
    endsAt: c.expires ? endsAt ?? null : null,
    combinesWith: {
      productDiscounts: !!c.combineProduct,
      orderDiscounts: !!c.combineOrder,
      shippingDiscounts: !!c.combineShipping,
    },
    // collectionIds would be resolved from c.collections handles before calling.
  };
}

export async function bulkCreateDiscounts(params: {
  affiliates: { id: string; refCode: string }[];
  percent: number;
  prefix?: string;
}) {
  const created: { code: string }[] = [];
  const failed: { code: string; error: string }[] = [];

  for (const aff of params.affiliates) {
    const code = `${params.prefix ?? ""}${aff.refCode}${params.percent}`.toUpperCase();
    try {
      const shopifyDiscountId = await createDiscountForAffiliate(code, params.percent);
      if (db) {
        await db.insert(discountCodes).values({
          affiliateId: aff.id,
          code,
          percentage: params.percent.toString(),
          shopifyDiscountId,
        });
      }
      created.push({ code });
    } catch (e: any) {
      failed.push({ code, error: e.message });
    }
    // Throttle to respect Shopify's cost-based GraphQL rate limits.
    await new Promise((r) => setTimeout(r, 550));
  }
  return { created, failed };
}
