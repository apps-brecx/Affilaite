// lib/uploads.ts — image uploads, stored in Shopify Files (permanent CDN URL).
//
// No separate storage bucket needed: we stage an upload with Shopify, POST the
// bytes to the staged target, register the file with fileCreate, then poll until
// Shopify's CDN URL is ready. Requires the Admin API token to have write_files.
import { shopifyGraphQL } from "./shopify";

export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const uerr = (a: any) => (Array.isArray(a) && a.length ? a.map((e: any) => e.message).join("; ") : "");
// Top-level GraphQL errors (e.g. "Access denied … Required access: `write_files`").
const gqlErr = (r: any) => (Array.isArray(r?.errors) && r.errors.length ? r.errors.map((e: any) => e.message).join("; ") : "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Upload image bytes to Shopify Files; resolves to the permanent CDN URL. */
export async function uploadImageToShopify(bytes: Uint8Array, filename: string, mimeType: string): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) throw new Error("Unsupported image type.");
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is too large (max 5 MB).");

  // 1. Ask Shopify for a staged upload target.
  const staged: any = await shopifyGraphQL(
    `mutation stage($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    { input: [{ filename: filename.slice(0, 120) || "image", mimeType, httpMethod: "POST", resource: "IMAGE", fileSize: String(bytes.byteLength) }] },
  );
  if (gqlErr(staged)) throw new Error(gqlErr(staged));
  const err1 = uerr(staged?.data?.stagedUploadsCreate?.userErrors);
  const target = staged?.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (err1 || !target?.url) throw new Error(err1 || "Couldn't start the upload.");

  // 2. POST the bytes to the staged target (params first, file last).
  const form = new FormData();
  for (const p of target.parameters ?? []) form.append(p.name, p.value);
  form.append("file", new Blob([bytes as unknown as BlobPart], { type: mimeType }), filename || "image");
  const up = await fetch(target.url, { method: "POST", body: form });
  if (!up.ok) {
    const body = await up.text().catch(() => "");
    throw new Error(`Upload to storage failed (${up.status})${body ? `: ${body.slice(0, 180)}` : ""}.`);
  }

  // 3. Register the uploaded file with Shopify.
  const created: any = await shopifyGraphQL(
    `mutation create($files: [FileCreateInput!]!) {
      fileCreate(files: $files) { files { id fileStatus ... on MediaImage { image { url } } } userErrors { field message } }
    }`,
    { files: [{ originalSource: target.resourceUrl, contentType: "IMAGE" }] },
  );
  if (gqlErr(created)) throw new Error(gqlErr(created));
  const err2 = uerr(created?.data?.fileCreate?.userErrors);
  const file = created?.data?.fileCreate?.files?.[0];
  if (err2 || !file?.id) throw new Error(err2 || "Couldn't save the image.");
  if (file.image?.url) return file.image.url;

  // 4. fileCreate is async — poll the node until the CDN URL is READY.
  for (let i = 0; i < 15; i++) {
    await sleep(600);
    const node: any = await shopifyGraphQL(
      `query($id: ID!) { node(id: $id) { ... on MediaImage { fileStatus image { url } } } }`,
      { id: file.id },
    );
    const n = node?.data?.node;
    if (n?.image?.url) return n.image.url;
    if (n?.fileStatus === "FAILED") throw new Error("Shopify couldn't process the image.");
  }
  throw new Error("The image is still processing — try again in a moment.");
}
