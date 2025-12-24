import {
  BadRequestError,
  ServiceUnavailableError,
} from '@/shared/lib/api/errors';
import type { JsonObject, JsonValue } from '@/shared/lib/json';
import {
  ProviderRegistry,
  trimmedProviderNameKey,
} from '@/shared/lib/providers/provider-registry';

/**
 * Payment price interface
 */
export interface PaymentPrice {
  amount: number;
  currency: string;
}

/**
 * Payment discount interface
 */
export interface PaymentDiscount {
  code: string;
}

/**
 * Payment customer interface
 */
export interface PaymentCustomer {
  id?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentCustomField {
  type: string;
  name: string;
  label: string;
  isRequired?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Payment product interface
 */
export interface PaymentProduct {
  id: string;
  name?: string;
  description?: string;
  price: PaymentPrice;
  metadata?: Record<string, unknown>;
}

export enum PaymentType {
  ONE_TIME = 'one-time',
  SUBSCRIPTION = 'subscription',
  RENEW = 'renew',
}

export enum PaymentInterval {
  ONE_TIME = 'one-time',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export enum PaymentStatus {
  PROCESSING = 'processing', // processing means waiting for payment
  // final status
  SUCCESS = 'paid', // paid means payment success
  FAILED = 'failed', // failed means payment failed
  CANCELED = 'canceled', // canceled means payment canceled
}

/**
 * Payment subscription plan interface
 */
export interface PaymentPlan {
  id?: string;
  name: string;
  description?: string;
  interval: PaymentInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Payment order interface for create payment
 */
export interface PaymentOrder {
  type?: PaymentType; // optional
  orderNo?: string; // order no
  productId?: string; // create product first
  requestId?: string; // request id
  price?: PaymentPrice; // required if productId is not provided
  discount?: PaymentDiscount; // discount code
  quantity?: number; // quantity
  customer?: PaymentCustomer;
  description?: string; // checkout description
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
  plan?: PaymentPlan; // required for subscription
  customFields?: PaymentCustomField[]; // optional for custom fields
}

/**
 * Checkout info interface
 */
export interface CheckoutInfo {
  sessionId: string;
  checkoutUrl: string;
}

export enum SubscriptionCycleType {
  CREATE = 'create',
  RENEWAL = 'renew',
}

/**
 * Payment info interface
 */
export interface PaymentInfo {
  description?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  discountCode?: string;
  discountAmount?: number;
  discountCurrency?: string;
  paymentAmount: number;
  paymentCurrency: string;
  paymentEmail?: string;
  paymentUserName?: string;
  paymentUserId?: string;
  paidAt?: Date;
  invoiceId?: string;
  invoiceUrl?: string;
  subscriptionCycleType?: SubscriptionCycleType;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PENDING_CANCEL = 'pending_cancel',
  CANCELED = 'canceled',
  TRIALING = 'trialing',
  EXPIRED = 'expired',
  PAUSED = 'paused',
}

export interface SubscriptionInfo {
  subscriptionId: string;
  planId?: string;
  productId?: string;
  description?: string;
  amount?: number;
  currency?: string;
  interval?: PaymentInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  billingUrl?: string;
  metadata?: Record<string, unknown>;
  status?: SubscriptionStatus;
  canceledAt?: Date; // cancel apply at
  canceledReason?: string; // cancel reason
  canceledReasonType?: string; // cancel reason type
  canceledEndAt?: Date; // cancel end at
}

/**
 * Checkout session interface
 */
export interface CheckoutSession {
  provider: string;

  checkoutParams: JsonValue; // checkout request params (json-serializable)
  checkoutInfo: CheckoutInfo; // checkout info after checkout success
  checkoutResult: JsonValue; // provider checkout result (json-serializable)

  metadata: JsonObject;
}

/**
 * Payment session interface
 */
export interface PaymentSession {
  provider: string;

  // payment info
  paymentStatus?: PaymentStatus; // payment status
  paymentInfo?: PaymentInfo; // payment info after payment success
  paymentResult?: JsonValue; // provider payment result (json-serializable)

  // subscription info
  subscriptionId?: string;
  subscriptionInfo?: SubscriptionInfo; // subscription info after subscription success
  subscriptionResult?: JsonValue; // provider subscription result (json-serializable)

  metadata?: JsonObject;
}

export enum PaymentEventType {
  CHECKOUT_SUCCESS = 'checkout.success', // checkout success
  PAYMENT_SUCCESS = 'payment.success', // payment success
  PAYMENT_FAILED = 'payment.failed', // payment failed
  PAYMENT_REFUNDED = 'payment.refunded', // payment refunded
  SUBSCRIBE_UPDATED = 'subscribe.updated', // subscription updated
  SUBSCRIBE_CANCELED = 'subscribe.canceled', // subscription canceled
}

export type EventInfo = Record<string, unknown>;

/**
 * Webhook error types (for stable HTTP status mapping in Route Handlers)
 */
export class WebhookVerificationError extends Error {
  constructor(message = 'invalid webhook signature') {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export class WebhookPayloadError extends Error {
  constructor(message = 'invalid webhook payload') {
    super(message);
    this.name = 'WebhookPayloadError';
  }
}

export class WebhookConfigError extends Error {
  constructor(message = 'webhook config error') {
    super(message);
    this.name = 'WebhookConfigError';
  }
}

/**
 * Payment event interface
 */
export interface PaymentEvent {
  eventType: PaymentEventType;
  eventResult: JsonValue; // provider event result (json-serializable)

  paymentSession: PaymentSession;
}

/**
 * Raw provider output types (driver-level)
 *
 * - Used by provider implementations (Stripe/Creem/PayPal)
 * - Converted and validated by adapter into stable contracts above
 */
export interface RawCheckoutSession {
  provider: string;
  checkoutParams: unknown;
  checkoutInfo: CheckoutInfo;
  checkoutResult: unknown;
  metadata: Record<string, unknown>;
}

export interface RawPaymentSession {
  provider: string;
  paymentStatus?: PaymentStatus;
  paymentInfo?: PaymentInfo;
  paymentResult?: unknown;
  subscriptionId?: string;
  subscriptionInfo?: SubscriptionInfo;
  subscriptionResult?: unknown;
  metadata?: Record<string, unknown>;
}

export interface RawPaymentEvent {
  eventType: PaymentEventType;
  eventResult: unknown;
  paymentSession: RawPaymentSession;
}

export interface PaymentInvoice {
  invoiceId: string;
  invoiceUrl?: string;
  amount?: number;
  currency?: string;
}

export interface PaymentBilling {
  billingUrl?: string;
}

/**
 * Payment configs interface
 */
export interface PaymentConfigs {
  [key: string]: unknown;
}

/**
 * Payment provider interface
 */
export interface PaymentProvider {
  // provider name
  readonly name: string;

  // provider configs
  configs: PaymentConfigs;

  // create payment
  createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession>;

  // get payment session
  getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession>;

  // get payment event from webhook notification
  getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent>;

  // get payment invoice
  getPaymentInvoice?({
    invoiceId,
  }: {
    invoiceId: string;
  }): Promise<PaymentInvoice>;

  // get payment billing
  getPaymentBilling?({
    customerId,
    returnUrl,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling>;

  // cancel subscription
  cancelSubscription?({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession>;
}

/**
 * Payment provider driver interface (provider-specific, before adapter)
 */
export interface PaymentProviderDriver {
  readonly name: string;
  configs: PaymentConfigs;

  createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<RawCheckoutSession>;

  getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<RawPaymentSession>;

  getPaymentEvent({ req }: { req: Request }): Promise<RawPaymentEvent>;

  getPaymentInvoice?({
    invoiceId,
  }: {
    invoiceId: string;
  }): Promise<PaymentInvoice>;

  getPaymentBilling?({
    customerId,
    returnUrl,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling>;

  cancelSubscription?({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<RawPaymentSession>;
}

/**
 * Payment manager to manage all payment providers
 */
export class PaymentManager {
  private readonly registry = new ProviderRegistry<PaymentProvider>({
    toNameKey: trimmedProviderNameKey,
  });

  hasProvider(name: string): boolean {
    return this.registry.has(name);
  }

  // add payment provider
  addProvider(provider: PaymentProvider, isDefault = false) {
    const name = trimmedProviderNameKey(provider?.name);
    if (!name) {
      throw new ServiceUnavailableError('Payment provider name is required');
    }
    if (this.registry.has(name)) {
      throw new ServiceUnavailableError(
        `Payment provider '${name}' is already registered`
      );
    }
    this.registry.add(provider, isDefault);
  }

  removeProvider(name: string): boolean {
    return this.registry.remove(name);
  }

  clearProviders(): void {
    this.registry.clear();
  }

  setDefaultProvider(name: string): void {
    if (!this.registry.setDefault(name)) {
      throw new ServiceUnavailableError(`Payment provider '${name}' not found`);
    }
  }

  // get provider by name
  getProvider(name: string): PaymentProvider | undefined {
    return this.registry.get(name);
  }

  // get all provider names
  getProviderNames(): string[] {
    return this.registry.getProviderNames();
  }

  getDefaultProvider(): PaymentProvider | undefined {
    return this.registry.getDefault();
  }

  // create payment using default provider
  async createPayment({
    order,
    provider,
  }: {
    order: PaymentOrder;
    provider?: string;
  }): Promise<CheckoutSession> {
    if (provider) {
      const providerInstance = this.getProvider(provider);
      if (!providerInstance) {
        throw new BadRequestError(`Payment provider '${provider}' not found`);
      }
      return providerInstance.createPayment({ order });
    }

    const defaultProvider = this.getDefaultProvider();
    if (!defaultProvider) {
      throw new ServiceUnavailableError('No payment provider configured');
    }

    return defaultProvider.createPayment({ order });
  }

  // get payment session using default provider
  async getPaymentSession({
    sessionId,
    provider,
  }: {
    sessionId: string;
    provider?: string;
  }): Promise<PaymentSession | null> {
    if (provider) {
      const providerInstance = this.getProvider(provider);
      if (!providerInstance) {
        throw new BadRequestError(`Payment provider '${provider}' not found`);
      }
      return providerInstance.getPaymentSession({ sessionId });
    }

    const defaultProvider = this.getDefaultProvider();
    if (!defaultProvider) {
      throw new ServiceUnavailableError('No payment provider configured');
    }

    return defaultProvider.getPaymentSession({ sessionId });
  }

  // handle webhook using specific provider
  async getPaymentEvent({
    req,
    provider,
  }: {
    req: Request;
    provider?: string;
  }): Promise<PaymentEvent> {
    if (provider) {
      const providerInstance = this.getProvider(provider);
      if (!providerInstance) {
        throw new BadRequestError(`Payment provider '${provider}' not found`);
      }
      return providerInstance.getPaymentEvent({ req });
    }

    const defaultProvider = this.getDefaultProvider();
    if (!defaultProvider) {
      throw new ServiceUnavailableError('No payment provider configured');
    }

    return defaultProvider.getPaymentEvent({ req });
  }
}

// Global payment manager instance
export const paymentManager = new PaymentManager();

// Providers are exported via `./providers` (server-only)
