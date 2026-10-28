/**
 * Subscription & Payment Domain Types
 * Milestone 05: Subscriptions & Payment Foundation
 */

export type SubscriptionTier = 'free' | 'pro' | 'cohort';

export type SubscriptionStatus =
  | 'free'
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete'
  | 'paused';

export interface UserSubscription {
  id: string;
  userId: string;
  customerId: string;
  subscriptionId: string | null;
  status: SubscriptionStatus;
  planTier: SubscriptionTier;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  latestEventCreated?: string | null;
  updatedAt: string;
}

export interface UserEntitlements {
  tier: SubscriptionTier;
  isActive: boolean;
  features: string[];
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  status: SubscriptionStatus;
}

export interface PlanCatalogueItem {
  id: SubscriptionTier;
  name: string;
  priceFormatted: string;
  interval: 'month' | 'year' | 'forever';
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
  signature?: string;
}

export interface CheckoutSessionRequest {
  planTier: 'pro' | 'cohort';
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface CustomerPortalResponse {
  portalUrl: string;
}

