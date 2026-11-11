/**
 * Subscription & Payment Domain Types
 * Milestone 05: Subscriptions & Payment Foundation (Razorpay Integration)
 *
 * TRAKIFY COMMERCIAL MODEL (5 ONE-TIME PASSES):
 *   1. pass_7d:    7-Day Pass      (₹20 · 7 days)
 *   2. pass_30d:   Monthly Pass    (₹75 · 30 days)
 *   3. pass_180d:  Semester Pass   (₹425 · 180 days)
 *   4. pass_365d:  Annual Pass     (₹825 · 365 days)
 *   5. pass_1460d: Full Degree Pass (₹3,300 · 1,460 days)
 */

export type TrakifyPassId =
  | 'pass_7d'
  | 'pass_30d'
  | 'pass_180d'
  | 'pass_365d'
  | 'pass_1460d';

export type SubscriptionTier = 'free' | 'pro' | 'paid' | 'cohort';

export type SubscriptionProvider = 'razorpay';

export type SubscriptionStatus =
  | 'free'
  | 'active'
  | 'authenticated'
  | 'trialing'
  | 'past_due'
  | 'halted'
  | 'pending'
  | 'cancelled'
  | 'canceled'
  | 'unpaid'
  | 'completed'
  | 'paused';

export type PaymentBillingMode = 'recurring' | 'one_time';

export interface UserSubscription {
  id: string;
  userId: string;
  provider?: SubscriptionProvider;
  customerId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  subscriptionId?: string | null;
  status: SubscriptionStatus;
  planTier: SubscriptionTier;
  planId?: TrakifyPassId | string | null;
  durationDays?: number | null;
  billingMode?: PaymentBillingMode;
  billingInterval?: 'month' | 'year' | 'one_time' | 'forever';
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  latestEventCreated?: number | string | null;
  lastVerifiedPayment?: string | null;
  updatedAt: string;
}

export interface UserEntitlements {
  tier: SubscriptionTier;
  hasActivePass: boolean;
  isActive: boolean;
  features: string[];
  planId?: TrakifyPassId | string | null;
  currentPeriodEnd: string | null;
  daysRemaining?: number;
  cancelAtPeriodEnd: boolean;
  status: SubscriptionStatus;
}

export interface TrakifyPassCatalogueItem {
  id: TrakifyPassId;
  name: string;
  priceInr: number;
  priceInrFormatted: string;
  durationDays: number;
  durationLabel: string;
  description: string;
  badge?: string;
  highlighted?: boolean;
}

export interface PlanCatalogueItem {
  id: string;
  name: string;
  priceFormatted: string;
  priceInrFormatted?: string;
  interval: 'month' | 'year' | 'forever' | 'one_time';
  description: string;
  features: string[];
  durationDays?: number;
  highlighted?: boolean;
  badge?: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
  signature?: string;
}

export interface RazorpayOrderRequest {
  planId?: TrakifyPassId | string;
  planTier?: 'pro' | 'cohort' | string;
  billingMode?: PaymentBillingMode;
}

export interface RazorpayOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planId?: TrakifyPassId | string;
  planTier?: 'pro' | 'cohort' | string;
  durationDays?: number;
  receipt?: string;
}

export interface RazorpaySubscriptionRequest {
  planTier: 'pro' | 'cohort';
}

export interface RazorpaySubscriptionResponse {
  subscriptionId: string;
  keyId: string;
  planTier: 'pro' | 'cohort';
  status?: string;
}

export interface RazorpayPaymentVerificationRequest {
  razorpay_order_id?: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  razorpay_subscription_id?: string;
  planId?: TrakifyPassId | string;
  planTier?: 'pro' | 'cohort' | string;
  billingMode?: PaymentBillingMode;
}

export interface RazorpayPaymentVerificationResponse {
  success: boolean;
  verified: boolean;
  planTier?: SubscriptionTier;
  status?: SubscriptionStatus;
  currentPeriodEnd?: string;
  paymentId?: string;
  orderId?: string | null;
  subscriptionId?: string | null;
  error?: string;
}

export interface CancelSubscriptionResponse {
  success: boolean;
  cancelAtPeriodEnd?: boolean;
  message?: string;
  error?: string;
}

// Compatibility mappings for transitional components
export interface CheckoutSessionRequest {
  planTier: 'pro' | 'cohort';
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl?: string;
  sessionId?: string;
  orderId?: string;
  keyId?: string;
}

export interface CustomerPortalResponse {
  portalUrl?: string;
  success?: boolean;
}
