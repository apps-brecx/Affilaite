import QRCode from "qrcode";

export const APP_URL = process.env.APP_URL ?? "https://affilaite.onrender.com";
export const STORE_URL =
  process.env.SHOPIFY_STORE_DOMAIN
    ? `https://${process.env.SHOPIFY_STORE_DOMAIN}`
    : "https://your-store.com";

/** The affiliate's trackable referral link (routes through /api/track). */
export function buildReferralLink(refCode: string, targetUrl?: string) {
  const to = encodeURIComponent(targetUrl ?? STORE_URL);
  return `${APP_URL}/api/track?ref=${encodeURIComponent(refCode)}&to=${to}`;
}

export async function qrDataUrl(text: string, dark = "#0f3d2e") {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    color: { dark, light: "#00000000" },
    errorCorrectionLevel: "M",
    width: 200,
  });
}
