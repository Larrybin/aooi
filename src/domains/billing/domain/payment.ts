export interface PaymentPrice {
  amount: number;
  currency: string;
}

export interface PaymentDiscount {
  code: string;
}

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
  PROCESSING = 'processing',
  SUCCESS = 'paid',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export interface PaymentPlan {
  id?: string;
  name: string;
  description?: string;
  interval: PaymentInterval;
  intervalCount?: number;
  trialPeriodDays?: number;
  metadata?: Record<string, unknown>;
}

export interface PaymentOrder {
  type?: PaymentType;
  orderNo?: string;
  productId?: string;
  requestId?: string;
  price?: PaymentPrice;
  discount?: PaymentDiscount;
  quantity?: number;
  customer?: PaymentCustomer;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, unknown>;
  plan?: PaymentPlan;
  customFields?: PaymentCustomField[];
}

export interface CheckoutInfo {
  sessionId: string;
  checkoutUrl: string;
}

export enum SubscriptionCycleType {
  CREATE = 'create',
  RENEWAL = 'renew',
}

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
  canceledAt?: Date;
  canceledReason?: string;
  canceledReasonType?: string;
  canceledEndAt?: Date;
}

export interface CheckoutSession {
  provider: string;
  checkoutParams: unknown;
  checkoutInfo: CheckoutInfo;
  checkoutResult: unknown;
  metadata: Record<string, unknown>;
}

export interface PaymentSession {
  provider: string;
  paymentStatus?: PaymentStatus;
  paymentInfo?: PaymentInfo;
  paymentResult?: unknown;
  subscriptionId?: string;
  subscriptionInfo?: SubscriptionInfo;
  subscriptionResult?: unknown;
  metadata?: Record<string, unknown>;
}

export enum PaymentEventType {
  CHECKOUT_SUCCESS = 'checkout.success',
  PAYMENT_SUCCESS = 'payment.success',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  SUBSCRIBE_UPDATED = 'subscribe.updated',
  SUBSCRIBE_CANCELED = 'subscribe.canceled',
  UNKNOWN = 'unknown',
}

export type EventInfo = Record<string, unknown>;

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

export interface PaymentEvent {
  eventType: PaymentEventType;
  eventResult: unknown;
  paymentSession: PaymentSession;
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

export interface PaymentConfigs {
  [key: string]: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  configs: PaymentConfigs;
  createPayment({ order }: { order: PaymentOrder }): Promise<CheckoutSession>;
  getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession>;
  getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent>;
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
  }): Promise<PaymentSession>;
}
