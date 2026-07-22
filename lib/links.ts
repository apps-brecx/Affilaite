import QRCode from "qrcode";

export const APP_URL = process.env.APP_URL ?? "https://affilaite.onrender.com";
export const STORE_URL =
  process.env.SHOPIFY_STORE_DOMAIN
    ? `https://${process.env.SHOPIFY_STORE_DOMAIN}`
    : "https://your-store.com";

/**
 * The affiliate's trackable referral link (routes through /api/track).
 * `appUrl` can be passed explicitly so client components don't fall back to
 * the build-time default (server env isn't available in the browser bundle).
 */
export function buildReferralLink(refCode: string, targetUrl?: string, appUrl: string = APP_URL) {
  const to = encodeURIComponent(targetUrl ?? STORE_URL);
  return `${appUrl}/api/track?ref=${encodeURIComponent(refCode)}&to=${to}`;
}

export async function qrDataUrl(text: string, dark = "#431431") {
  return QRCode.toString(text, {
    type: "svg",
    margin: 1,
    color: { dark, light: "#00000000" },
    errorCorrectionLevel: "M",
    width: 200,
  });
}

/**
 * QR as a PNG data URL — solid black on a solid white background so it always
 * scans (light or dark theme) and can be downloaded as a real image file.
 */
export async function qrPngDataUrl(text: string) {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: 512,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });
}
