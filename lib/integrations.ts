// lib/integrations.ts — effective integration credentials.
// Values entered in the UI are stored in app_settings (secrets encrypted at
// rest with AES-256-GCM keyed off AUTH_SECRET) and take precedence; otherwise
// we fall back to environment variables. The rest of the app reads through the
// getters here so it works with either source.
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

// Fail hard rather than fall open to a public dev key: integration secrets are
// encrypted with a key derived from AUTH_SECRET, so it must be set in any real
// deployment (the same secret NextAuth already requires).
if (!process.env.AUTH_SECRET) {
  throw new Error("AUTH_SECRET is required — it derives the key that encrypts integration secrets.");
}
const KEY = crypto.scryptSync(process.env.AUTH_SECRET, "syruvia-integrations", 32);

export function encryptSecret(text: string): string {
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return "enc:" + Buffer.concat([iv, tag, ct]).toString("base64");
}

function decryptSecret(stored: string | null | undefined): string {
  if (!stored) return "";
  if (!stored.startsWith("enc:")) return stored;
  try {
    const raw = Buffer.from(stored.slice(4), "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

async function raw(key: string): Promise<string | null> {
  if (!db) return null;
  const row = await db.query.appSettings.findFirst({ where: eq(appSettings.key, key) });
  return row?.value ?? null;
}

/** Effective plain value: DB value, else env fallback. */
async function plain(dbKey: string, envKey: string, fallback = ""): Promise<string> {
  const v = await raw(dbKey);
  return (v ?? process.env[envKey] ?? fallback) || fallback;
}

/** Effective secret value: decrypted DB value, else env fallback. */
async function secret(dbKey: string, envKey: string): Promise<string> {
  const v = await raw(dbKey);
  if (v) return decryptSecret(v);
  return process.env[envKey] ?? "";
}

// A masked hint for display (so the UI can show "set" without revealing it).
export function mask(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "••••";
  return value.slice(0, 3) + "••••••" + value.slice(-2);
}

// ---------- Effective configs ----------

export async function shopifyConfig() {
  return {
    domain: await plain("int_shopify_domain", "SHOPIFY_STORE_DOMAIN"),
    token: await secret("int_shopify_token", "SHOPIFY_ADMIN_TOKEN"),
    apiSecret: await secret("int_shopify_secret", "SHOPIFY_API_SECRET"),
    version: await plain("int_shopify_version", "SHOPIFY_API_VERSION", "2025-07"),
  };
}

export async function paypalConfig() {
  return {
    clientId: await secret("int_paypal_client_id", "PAYPAL_CLIENT_ID"),
    clientSecret: await secret("int_paypal_client_secret", "PAYPAL_CLIENT_SECRET"),
    base: await plain("int_paypal_base", "PAYPAL_BASE", "https://api-m.sandbox.paypal.com"),
    webhookId: await plain("int_paypal_webhook_id", "PAYPAL_WEBHOOK_ID"),
  };
}

export async function smsConfig() {
  return {
    provider: await plain("int_sms_provider", "SMS_PROVIDER"),
    accountSid: await plain("int_sms_account_sid", "TWILIO_ACCOUNT_SID"),
    apiKey: await secret("int_sms_key", "SMS_API_KEY"),
    apiSecret: await secret("int_sms_secret", "SMS_API_SECRET"),
    from: await plain("int_sms_from", "SMS_FROM"),
  };
}

export async function emailConfig() {
  return {
    apiKey: await secret("int_resend_key", "RESEND_API_KEY"),
    from: await plain("int_email_from", "EMAIL_FROM", "Syruvia <affiliates@yourbrand.com>"),
  };
}

export async function shopifyReady() {
  const c = await shopifyConfig();
  return Boolean(c.domain && c.token);
}
export async function paypalReady() {
  const c = await paypalConfig();
  return Boolean(c.clientId && c.clientSecret);
}
export async function emailReady() {
  const c = await emailConfig();
  return Boolean(c.apiKey);
}
export async function smsReady() {
  const c = await smsConfig();
  return Boolean(c.provider);
}

/** Non-secret status snapshot for the Settings UI. */
export async function integrationsStatus() {
  const [s, p, e, sms] = await Promise.all([shopifyConfig(), paypalConfig(), emailConfig(), smsConfig()]);
  return {
    shopify: { ready: Boolean(s.domain && s.token), domain: s.domain, version: s.version, tokenMask: mask(s.token), secretMask: mask(s.apiSecret) },
    paypal: { ready: Boolean(p.clientId && p.clientSecret), base: p.base, clientIdMask: mask(p.clientId), clientSecretMask: mask(p.clientSecret), webhookId: p.webhookId },
    email: { ready: Boolean(e.apiKey), from: e.from, keyMask: mask(e.apiKey) },
    sms: { ready: Boolean(sms.provider), provider: sms.provider, accountSid: sms.accountSid, from: sms.from, keyMask: mask(sms.apiKey), secretMask: mask(sms.apiSecret) },
  };
}
