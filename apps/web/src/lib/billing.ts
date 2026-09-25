'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionStatus } from './api-types';
import { api } from './auth/session';
import type { PublicPlan } from './plans';
import { useQueryScope } from './queries';

// apps/api billing DTOs; money in rupees unless named *Paise

export interface Subscription {
  id: string;
  planCode: string;
  planName: string;
  status: SubscriptionStatus;
  trialEndsAt: string;
  trialDaysRemaining: number;
  currentPeriodEnd: string;
  gracePeriodEndsAt?: string | null;
  isGracePeriod: boolean;
  features: string[];
  aiCreditBalance: number;
  aiCreditPricePaise: number;
}

export interface BillingPayment {
  id: string;
  orderId: string;
  type: 'PLAN_UPGRADE' | 'AI_CREDITS';
  status: 'PAID' | 'FAILED';
  planCode?: string | null;
  billingCycle?: 'MONTHLY' | 'YEARLY' | null;
  credits?: number | null;
  amount: number;
  invoiceNumber?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export type OrderRequest =
  | { type: 'PLAN_UPGRADE'; planCode: string; billingCycle: 'MONTHLY' | 'YEARLY' }
  | { type: 'AI_CREDITS'; credits: number };

export interface PaymentOrder {
  orderId: string;
  /** Rupees */
  amount: number;
  currency: string;
  keyId?: string;
  receipt: string;
  /** No real gateway behind it (development without Razorpay keys) */
  mock?: boolean;
}

export const CREDIT_PACKS = [100, 500, 1000, 5000] as const;

/** Rupees for a number of AI credits at the server's price */
export function creditsPrice(credits: number, pricePaise: number): number {
  return (credits * pricePaise) / 100;
}

export function useSubscription(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'billing', 'subscription'],
    queryFn: ({ signal }) => api.get<Subscription>('/billing/subscription', { signal }),
    enabled,
  });
}

export function usePlans() {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'billing', 'plans'],
    queryFn: ({ signal }) => api.get<PublicPlan[]>('/billing/plans', { signal }),
    staleTime: 10 * 60_000,
  });
}

export function useBillingPayments(enabled = true) {
  const scope = useQueryScope();
  return useQuery({
    queryKey: [scope, 'billing', 'payments'],
    queryFn: ({ signal }) => api.get<BillingPayment[]>('/billing/payments', { signal }),
    enabled,
  });
}

/** A settled payment changes the plan, the credits and the shell's subscription banner */
export function useRefreshBilling() {
  const queryClient = useQueryClient();
  const scope = useQueryScope();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [scope, 'billing'] }),
      queryClient.invalidateQueries({ queryKey: [scope, 'coaching', 'me'] }),
    ]);
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: OrderRequest) => api.post<PaymentOrder>('/billing/orders', input),
  });
}

export function useSimulatePayment() {
  return useMutation({
    mutationFn: (orderId: string) =>
      api.post<{ status: string }>(`/billing/orders/${orderId}/simulate-payment`),
  });
}

// ---------- Razorpay Checkout ----------

const CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', handler: (response: unknown) => void): void;
}
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

let checkoutScript: Promise<RazorpayConstructor> | null = null;

/** Loads Razorpay's checkout script once, on first purchase rather than with every page */
function loadCheckout(): Promise<RazorpayConstructor> {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  checkoutScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_URL;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (loaded) resolve(loaded);
      else reject(new Error('Razorpay did not load'));
    };
    script.onerror = () => {
      checkoutScript = null;
      reject(new Error('Razorpay did not load'));
    };
    document.head.append(script);
  });
  return checkoutScript;
}

export type CheckoutOutcome = 'paid' | 'cancelled' | 'failed';

/**
 * Opens Razorpay's payment window for an order. "paid" means Razorpay reported success; the
 * plan or credits are applied when its webhook reaches the API, a moment later.
 */
export async function openCheckout(
  order: PaymentOrder,
  details: { name: string; description: string; email?: string; contact?: string },
): Promise<CheckoutOutcome> {
  const Razorpay = await loadCheckout();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const checkout = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: Math.round(order.amount * 100),
      currency: order.currency,
      name: details.name,
      description: details.description,
      prefill: { email: details.email, contact: details.contact },
      theme: { color: '#c2410c' },
      handler: () => finish('paid'),
      modal: { ondismiss: () => finish('cancelled') },
    });
    checkout.on('payment.failed', () => finish('failed'));
    checkout.open();
  });
}
