// Shared view-model types used across pages and the data layer.

export type CommissionState =
  | "pending"
  | "approved"
  | "reversed"
  | "paid"
  | "rejected";
export type AffiliateState = "pending" | "approved" | "rejected" | "suspended";
export type PayoutState = "draft" | "processing" | "success" | "failed";

export interface Program {
  id: string;
  name: string;
  commissionType: "percent" | "flat";
  commissionValue: number;
  cookieWindowDays: number;
  holdDays: number;
  payoutMinimum: number;
  newCustomerOnly: boolean;
  isDefault: boolean;
  affiliateCount: number;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

export type CampaignType = "affiliate" | "referral";
export type CampaignStatus = "active" | "paused" | "ended";
export type CampaignAccess = "instant" | "approval" | "invite";

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  access: CampaignAccess;
  slug: string | null;
  shortCode: string | null;
  destinationUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  description: string;
  codePrefix: string | null;
  rewardType: "percent" | "flat";
  rewardValue: number;
  friendRewardType: "percent" | "flat";
  friendRewardValue: number;
  config: import("./campaign-config").CampaignConfig;
  memberCount: number;
}

export interface Affiliate {
  id: string;
  name: string;
  email: string;
  refCode: string;
  code: string; // discount code
  status: AffiliateState;
  paypalEmail: string | null;
  payoutMethod: "paypal" | "venmo";
  phone: string | null;
  phoneVerified: boolean;
  address: string | null; // composed single line (display / Shopify)
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  samplesBanned: boolean;
  companyName: string | null;
  programId: string;
  programName: string;
  payoutMinimum: number;
  notificationPrefs: Record<string, boolean>;
  groupId: string | null;
  groupName: string | null;
  socialLinks: Record<string, string>;
  clicks: number;
  orders: number;
  conversionRate: number; // %
  epc: number; // earnings per click
  pendingEarnings: number;
  approvedEarnings: number;
  paidEarnings: number;
  totalEarned: number;
  joinedAt: string;
  avatarUrl?: string;
}

export interface Order {
  id: string;
  shopifyOrderId: string;
  orderNumber: string;
  customerEmail: string;
  subtotal: number;
  total: number;
  currency: string;
  discountCodesUsed: string[];
  isNewCustomer: boolean;
  financialStatus: string;
  affiliateName: string | null;
  attributionStatus: string | null;
  createdAt: string;
}

/** An order tied to an affiliate — by a real commission, or by the code it used. */
export interface AffiliateOrder {
  id: string;
  shopifyOrderId: string;
  orderNumber: string;
  customerEmail: string;
  total: number;
  currency: string;
  financialStatus: string;
  affiliateId: string | null;
  affiliateName: string | null;
  affiliateCode: string | null;
  attributionStatus: string | null;
  commissionAmount: number | null;
  commissionStatus: string | null;
  createdAt: string;
}

export interface Commission {
  id: string;
  orderNumber: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  amount: number;
  currency: string;
  attributedBy: "coupon" | "link";
  status: CommissionState;
  orderTotal: number;
  approvableAt: string | null;
  flagged: boolean;
  flagReason: string | null;
  createdAt: string;
}

export interface PayoutItem {
  id: string;
  affiliateId: string | null;
  affiliateName: string;
  affiliateEmail: string;
  amount: number;
  currency: string;
  transactionStatus: string;
  paypalItemId: string | null;
}

export interface Payout {
  id: string;
  senderBatchId: string;
  paypalBatchId: string | null;
  status: PayoutState;
  totalAmount: number;
  affiliateCount: number;
  createdAt: string;
  items: PayoutItem[];
}

export interface Message {
  id: string;
  subject: string;
  body: string;
  channel: "email" | "sms";
  audienceLabel: string;
  recipients: number;
  openRate: number | null;
  scheduledFor: string | null;
  sentAt: string | null;
}

export interface Promotion {
  id: string;
  name: string;
  bonusType: "percent" | "flat";
  bonusValue: number;
  startsAt: string;
  endsAt: string;
  groupName: string;
  status: "scheduled" | "live" | "ended";
  product?: {
    id: string;
    title: string;
    image: string | null;
    url: string;
  } | null;
}

export interface Asset {
  id: string;
  title: string;
  kind: "banner" | "image" | "copy" | "video";
  dimensions: string;
  gradient: string;
}

export interface TimePoint {
  date: string;
  earnings: number;
  orders: number;
  clicks: number;
}

export interface AdminKpis {
  affiliateRevenue: number;
  affiliateRevenueDelta: number;
  activeAffiliates: number;
  activeAffiliatesDelta: number;
  pendingCommissions: number;
  pendingCommissionsCount: number;
  refundRate: number;
  refundRateDelta: number;
  payableNow: number;
  awaitingApproval: number;
}

export interface ChatAttachment {
  type: string; // image | video | file
  url: string;
  name?: string;
}
export interface ChatPollOption {
  text: string;
  votes: number;
}
export interface GroupChatMessage {
  id: string;
  body: string | null;
  attachments: ChatAttachment[];
  poll: { question: string; options: ChatPollOption[]; totalVotes: number } | null;
  myVote: number | null; // affiliate's chosen option index, if any
  createdAt: string;
  // Admin-only read receipts:
  readCount: number;
  readers: string[]; // affiliate names who've seen it
}

export interface SampleRequest {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateEmail: string;
  productId: string | null;
  productTitle: string;
  productImage: string | null;
  productUrl: string | null;
  note: string | null;
  address: string | null;
  status: "requested" | "approved" | "rejected" | "shipped";
  shopifyOrderId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  createdAt: string;
  decidedAt: string | null;
}
