// lib/queries.ts — the single data-access seam for the UI.
//
// Every page reads through these functions. Today they resolve from the
// deterministic demo dataset so the product renders beautifully with zero
// configuration. In production each function is where a Drizzle query against
// Neon slots in (guarded by `isDbConfigured`), returning the same shapes.
import { isDbConfigured } from "@/db";
import * as demo from "./demo-data";
import type {
  Affiliate,
  Commission,
  Order,
  Payout,
  Program,
  Group,
  Message,
  Promotion,
  Asset,
  TimePoint,
  AdminKpis,
  CommissionState,
} from "./types";

// A tiny helper so the intent ("use DB when available") is explicit and every
// call site is ready for the real implementation.
async function resolve<T>(demoValue: T /*, dbQuery?: () => Promise<T> */): Promise<T> {
  // if (isDbConfigured && dbQuery) return dbQuery();
  return demoValue;
}

export const dataSource = isDbConfigured ? "live" : "demo";

// --- Admin ---
export const getAdminKpis = () => resolve<AdminKpis>(demo.adminKpis);
export const getRevenueSeries = (days = 30) => resolve<TimePoint[]>(demo.earningsSeries(days, 640));
export const getTopAffiliates = (n = 6) =>
  resolve<Affiliate[]>(demo.affiliates.filter((a) => a.status === "approved").slice(0, n));
export const getPendingApprovals = () =>
  resolve<Affiliate[]>(demo.affiliates.filter((a) => a.status === "pending"));

export const listAffiliates = () => resolve<Affiliate[]>(demo.affiliates);
export const getAffiliate = (id: string) =>
  resolve<Affiliate | undefined>(demo.affiliates.find((a) => a.id === id));

export const listOrders = () => resolve<Order[]>(demo.orders);
export const listPrograms = () => resolve<Program[]>(demo.programs);
export const listGroups = () => resolve<Group[]>(demo.groups);
export const listMessages = () => resolve<Message[]>(demo.messages);
export const listPromotions = () => resolve<Promotion[]>(demo.promotions);
export const listAssets = () => resolve<Asset[]>(demo.assets);

export const listCommissions = (filter?: CommissionState) =>
  resolve<Commission[]>(
    filter ? demo.commissions.filter((c) => c.status === filter) : demo.commissions,
  );

export const listPayouts = () => resolve<Payout[]>(demo.payouts);

export const getPayableBatch = () =>
  resolve(
    demo.affiliates
      .filter((a) => a.status === "approved" && a.approvedEarnings >= 25 && a.paypalEmail)
      .map((a) => ({
        affiliateId: a.id,
        name: a.name,
        paypalEmail: a.paypalEmail!,
        amount: a.approvedEarnings,
      })),
  );

// --- Affiliate portal (current session's affiliate) ---
export const getCurrentAffiliate = () => resolve<Affiliate>(demo.currentAffiliate);
export const getAffiliateSummary = (a: Affiliate) => resolve(demo.affiliateSummary(a));
export const getAffiliateEarnings = (days = 30) =>
  resolve<TimePoint[]>(demo.earningsSeries(days, 42));
export const getAffiliateCommissions = (affiliateId: string) =>
  resolve<Commission[]>(demo.commissions.filter((c) => c.affiliateId === affiliateId).slice(0, 12));
