// lib/discounts.ts — bulk Shopify discount code creation (throttled).
import { db } from "@/db";
import { discountCodes } from "@/db/schema";
import { shopifyGraphQL } from "./shopify";

const CREATE_CODE = `
  mutation Create($basicCodeDiscount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }`;

export async function createDiscountForAffiliate(code: string, percent: number): Promise<string> {
  const variables = {
    basicCodeDiscount: {
      title: `Affiliate ${code}`,
      code,
      startsAt: new Date().toISOString(),
      customerSelection: { all: true },
      customerGets: { value: { percentage: percent / 100 }, items: { all: true } },
      appliesOncePerCustomer: false,
    },
  };
  const json = await shopifyGraphQL<any>(CREATE_CODE, variables);
  const errs = json.data?.discountCodeBasicCreate?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join(", "));
  return json.data.discountCodeBasicCreate.codeDiscountNode.id;
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
