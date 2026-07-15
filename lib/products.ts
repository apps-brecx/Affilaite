// lib/products.ts — read the store's product catalog from Shopify.
import { shopifyGraphQL } from "./shopify";
import { shopifyReady, shopifyConfig } from "./integrations";

export interface StoreProduct {
  id: string;
  title: string;
  handle: string;
  url: string;
  image: string | null;
  price: string | null;
  currency: string | null;
  available: boolean;
}

const PRODUCTS_QUERY = `
  query Catalog($first: Int!) {
    products(first: $first, sortKey: BEST_SELLING) {
      edges {
        node {
          id
          title
          handle
          status
          onlineStoreUrl
          totalInventory
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }`;

/**
 * Fetch the live product catalog. Returns `connected: false` when Shopify
 * isn't set up so the UI can show a friendly placeholder instead of an error.
 */
export async function getStoreProducts(limit = 24): Promise<{ connected: boolean; products: StoreProduct[] }> {
  if (!(await shopifyReady())) return { connected: false, products: [] };
  try {
    const { domain } = await shopifyConfig();
    const json = await shopifyGraphQL<any>(PRODUCTS_QUERY, { first: limit });
    const edges = json.data?.products?.edges ?? [];
    const products: StoreProduct[] = edges
      .map((e: any) => e.node)
      .filter((n: any) => n && n.status !== "ARCHIVED")
      .map((n: any) => {
        const price = n.priceRangeV2?.minVariantPrice;
        return {
          id: n.id as string,
          title: n.title as string,
          handle: n.handle as string,
          url: (n.onlineStoreUrl as string) || (domain ? `https://${domain}/products/${n.handle}` : `/products/${n.handle}`),
          image: n.featuredImage?.url ?? null,
          price: price?.amount ? Number(price.amount).toFixed(2) : null,
          currency: price?.currencyCode ?? null,
          available: (n.totalInventory ?? 0) > 0 || n.totalInventory == null,
        };
      });
    return { connected: true, products };
  } catch (e) {
    console.error("[getStoreProducts]", e);
    return { connected: true, products: [] };
  }
}
