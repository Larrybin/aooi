import { z } from 'zod';

import { safeFetchJson } from '@/shared/lib/fetch/server';

import {
  CheckoutSession,
  PaymentBilling,
  PaymentConfigs,
  PaymentCustomField,
  PaymentEvent,
  PaymentEventType,
  PaymentInterval,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionInfo,
  SubscriptionStatus,
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
} from '.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string' && error) return error;
  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return undefined;
};

const parseOrThrow = <Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown,
  error: Error
): z.infer<Schema> => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw error;
  }
  return parsed.data;
};

const creemWebhookEventSchema = z
  .object({
    eventType: z.string().min(1),
    object: z.unknown(),
  })
  .passthrough();

const creemCheckoutSessionSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    product: z.unknown().optional(),
    subscription: z.unknown().optional(),
    order: z.unknown().optional(),
    last_transaction: z.unknown().optional(),
    customer: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const creemOrderLikeSchema = z
  .object({
    status: z.string().optional(),
    transaction: z.string().optional(),
    id: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().optional(),
    amount_paid: z.number().optional(),
    currency: z.string().optional(),
    discount_amount: z.number().optional(),
    created_at: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

const creemSubscriptionSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    cancel_at: z.unknown().optional(),
    canceled_at: z.union([z.string(), z.number()]).optional(),
    current_period_start_date: z.union([z.string(), z.number()]),
    current_period_end_date: z.union([z.string(), z.number()]),
    created_at: z.union([z.string(), z.number()]).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    product: z.unknown().optional(),
  })
  .passthrough();

const creemProductSchema = z
  .object({
    id: z.string().optional(),
    billing_period: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
  })
  .passthrough();

const creemInvoiceSchema = z
  .object({
    status: z.string().optional(),
    order: z.unknown().optional(),
    last_transaction: z.unknown().optional(),
    subscription: z.unknown().optional(),
    customer: z
      .object({
        id: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
      })
      .optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const creemCreateCheckoutResponseSchema = z
  .object({
    id: z.string().optional(),
    checkout_url: z.string().optional(),
    error: z.unknown().optional(),
  })
  .passthrough();

const creemBillingResponseSchema = z
  .object({
    customer_portal_link: z.string().optional(),
  })
  .passthrough();

type CreemCheckoutSession = z.infer<typeof creemCheckoutSessionSchema>;
type CreemSubscription = z.infer<typeof creemSubscriptionSchema>;
type CreemProduct = z.infer<typeof creemProductSchema>;

/**
 * Creem payment provider configs
 * @docs https://docs.creem.io/
 */
export interface CreemConfigs extends PaymentConfigs {
  apiKey: string;
  signingSecret?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * Creem payment provider implementation
 * @website https://creem.io/
 */
export class CreemProvider implements PaymentProvider {
  readonly name = 'creem';
  configs: CreemConfigs;

  private baseUrl: string;

  constructor(configs: CreemConfigs) {
    this.configs = configs;
    this.baseUrl =
      configs.environment === 'production'
        ? 'https://api.creem.io'
        : 'https://test-api.creem.io';
  }

  // create payment
  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (!order.productId) {
      throw new Error('productId is required');
    }

    const payload: Record<string, unknown> = {
      product_id: order.productId,
      request_id: order.requestId || undefined,
      units: 1,
      discount_code: order.discount
        ? {
            code: order.discount.code,
          }
        : undefined,
      customer: order.customer
        ? {
            id: order.customer.id,
            email: order.customer.email,
          }
        : undefined,
      custom_fields: order.customFields
        ? order.customFields.map((customField: PaymentCustomField) => ({
            type: customField.type,
            key: customField.name,
            label: customField.label,
            optional: !customField.isRequired as boolean,
            text: customField.metadata,
          }))
        : undefined,
      success_url: order.successUrl,
      metadata: order.metadata,
    };

    const rawResult = await this.makeRequest('/v1/checkouts', 'POST', payload);
    const result = parseOrThrow(
      creemCreateCheckoutResponseSchema,
      rawResult,
      new Error('create payment failed')
    );

    const errorMessage = getErrorMessage(result.error);
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    if (!result.id || !result.checkout_url) {
      throw new Error('create payment failed');
    }

    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId: result.id,
        checkoutUrl: result.checkout_url,
      },
      checkoutResult: rawResult,
      metadata: order.metadata || {},
    };
  }

  // get payment by session id
  // @docs https://docs.creem.io/api-reference/endpoint/get-checkout
  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    const rawSession = await this.makeRequest(
      `/v1/checkouts?checkout_id=${sessionId}`,
      'GET'
    );

    const parsedSession = creemCheckoutSessionSchema.safeParse(rawSession);
    if (
      !parsedSession.success ||
      !parsedSession.data.id ||
      !parsedSession.data.order
    ) {
      const errorMessage = isRecord(rawSession)
        ? getErrorMessage(rawSession.error)
        : undefined;
      throw new Error(errorMessage || 'get payment failed');
    }

    return await this.buildPaymentSessionFromCheckoutSession(
      parsedSession.data
    );
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get('creem-signature') as string;

    if (!rawBody || !signature) {
      throw new WebhookVerificationError('invalid webhook request');
    }

    if (!this.configs.signingSecret) {
      throw new WebhookConfigError('signing secret not configured');
    }

    const computedSignature = await this.generateSignature(
      rawBody,
      this.configs.signingSecret
    );

    if (computedSignature !== signature) {
      throw new WebhookVerificationError('invalid webhook signature');
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new WebhookPayloadError('invalid webhook payload');
    }

    const webhookEvent = parseOrThrow(
      creemWebhookEventSchema,
      event,
      new WebhookPayloadError('invalid webhook payload')
    );

    const eventType = this.mapCreemEventType(webhookEvent.eventType);

    let paymentSession: PaymentSession | undefined = undefined;
    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      paymentSession = await this.buildPaymentSessionFromCheckoutSession(
        webhookEvent.object
      );
    } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
      paymentSession = await this.buildPaymentSessionFromInvoice(
        webhookEvent.object
      );
    } else if (eventType === PaymentEventType.SUBSCRIBE_UPDATED) {
      paymentSession = await this.buildPaymentSessionFromSubscription(
        webhookEvent.object
      );
    } else if (eventType === PaymentEventType.SUBSCRIBE_CANCELED) {
      paymentSession = await this.buildPaymentSessionFromSubscription(
        webhookEvent.object
      );
    }

    if (!paymentSession) {
      throw new WebhookPayloadError('invalid webhook event');
    }

    return {
      eventType,
      eventResult: webhookEvent,
      paymentSession,
    };
  }

  async getPaymentBilling({
    customerId,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling> {
    const rawBilling = await this.makeRequest('/v1/customers/billing', 'POST', {
      customer_id: customerId,
    });

    const billing = parseOrThrow(
      creemBillingResponseSchema,
      rawBilling,
      new Error('get billing url failed')
    );

    if (!billing.customer_portal_link) {
      throw new Error('get billing url failed');
    }

    return {
      billingUrl: billing.customer_portal_link,
    };
  }

  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    const rawResult = await this.makeRequest(
      `/v1/subscriptions/${subscriptionId}/cancel`,
      'POST'
    );

    const subscription = parseOrThrow(
      creemSubscriptionSchema,
      rawResult,
      new Error('cancel subscription failed')
    );
    if (!subscription.canceled_at) {
      throw new Error('cancel subscription failed');
    }

    return await this.buildPaymentSessionFromSubscription(subscription);
  }

  private async generateSignature(
    payload: string,
    secret: string
  ): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(payload);

      const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', key, messageData);

      const signatureArray = new Uint8Array(signature);
      return Array.from(signatureArray)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown signature error';
      throw new Error(`Failed to generate signature: ${message}`);
    }
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    data?: Record<string, unknown>
  ) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'x-api-key': this.configs.apiKey,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    return await safeFetchJson<unknown>(url, config, {
      timeoutMs: 15000,
      cache: 'no-store',
      errorMessage: 'request creem api failed',
    });
  }

  private mapCreemEventType(eventType: string): PaymentEventType {
    switch (eventType) {
      case 'checkout.completed':
        return PaymentEventType.CHECKOUT_SUCCESS;
      case 'subscription.paid':
        return PaymentEventType.PAYMENT_SUCCESS;
      case 'subscription.update':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.paused':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.active':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.canceled':
        return PaymentEventType.SUBSCRIBE_CANCELED;
      default:
        // not handle other event type
        // subscription.expired
        // subscription.trialing
        // refund.created
        // dispute.created
        throw new Error(`Not handle creem event type: ${eventType}`);
    }
  }

  private mapCreemStatusFromCheckoutSession(
    session: CreemCheckoutSession
  ): PaymentStatus {
    const orderCandidate = session.order ?? session.last_transaction;
    const order = creemOrderLikeSchema.safeParse(orderCandidate);
    const orderStatus = order.success ? order.data.status : undefined;

    if (orderStatus === 'paid') {
      return PaymentStatus.SUCCESS;
    } else {
      // todo: handle other status
      throw new Error(`Unknown Creem session status: ${session.status}`);
    }
  }

  private mapCreemStatus(session: unknown): PaymentStatus {
    const checkedSession = parseOrThrow(
      creemCheckoutSessionSchema,
      session,
      new WebhookPayloadError('invalid creem session payload')
    );
    return this.mapCreemStatusFromCheckoutSession(checkedSession);
  }

  // build payment session from checkout session
  private async buildPaymentSessionFromCheckoutSession(
    session: unknown
  ): Promise<PaymentSession> {
    const checkedSession = parseOrThrow(
      creemCheckoutSessionSchema,
      session,
      new WebhookPayloadError('invalid creem checkout session payload')
    );

    const subscriptionCandidate = checkedSession.subscription;
    const subscription = subscriptionCandidate
      ? parseOrThrow(
          creemSubscriptionSchema,
          subscriptionCandidate,
          new WebhookPayloadError('invalid creem subscription payload')
        )
      : undefined;

    const orderCandidate =
      checkedSession.order ?? checkedSession.last_transaction;
    const order = creemOrderLikeSchema.safeParse(orderCandidate);
    const checkedOrder = order.success ? order.data : undefined;

    const result: PaymentSession = {
      provider: this.name,
      paymentStatus: this.mapCreemStatusFromCheckoutSession(checkedSession),
      paymentInfo: {
        transactionId: checkedOrder?.transaction || checkedOrder?.id,
        amount: checkedOrder?.amount || 0,
        currency: checkedOrder?.currency || '',
        discountCode: '',
        discountAmount: checkedOrder?.discount_amount || 0,
        discountCurrency: checkedOrder?.currency || '',
        paymentAmount: checkedOrder?.amount_paid || 0,
        paymentCurrency: checkedOrder?.currency || '',
        paymentEmail: checkedSession.customer?.email,
        paymentUserName: checkedSession.customer?.name,
        paymentUserId: checkedSession.customer?.id,
        paidAt: checkedOrder?.created_at
          ? new Date(checkedOrder.created_at)
          : undefined,
        invoiceId: '', // todo: invoice id
        invoiceUrl: '',
      },
      paymentResult: checkedSession,
      metadata: checkedSession.metadata,
    };

    if (subscription) {
      result.subscriptionId = subscription.id;
      result.subscriptionInfo = await this.buildSubscriptionInfo(
        subscription,
        checkedSession.product
      );
      result.subscriptionResult = subscription;
    }

    return result;
  }

  // build payment session from subscription session
  private async buildPaymentSessionFromInvoice(
    invoice: unknown
  ): Promise<PaymentSession> {
    const checkedInvoice = parseOrThrow(
      creemInvoiceSchema,
      invoice,
      new WebhookPayloadError('invalid creem invoice payload')
    );

    const orderCandidate =
      checkedInvoice.order ?? checkedInvoice.last_transaction;
    const order = creemOrderLikeSchema.safeParse(orderCandidate);
    const checkedOrder = order.success ? order.data : undefined;

    const subscriptionCandidate = checkedInvoice.subscription ?? checkedInvoice;
    const subscription = parseOrThrow(
      creemSubscriptionSchema,
      subscriptionCandidate,
      new WebhookPayloadError('invalid creem subscription payload')
    );

    const subscriptionCreatedAt = subscription.created_at
      ? new Date(subscription.created_at)
      : new Date(0);
    const currentPeriodStartAt = new Date(
      subscription.current_period_start_date
    );
    const timeDiff =
      currentPeriodStartAt.getTime() - subscriptionCreatedAt.getTime();

    const cycleType =
      timeDiff < 5000 // 5s
        ? SubscriptionCycleType.CREATE
        : SubscriptionCycleType.RENEWAL;

    const result: PaymentSession = {
      provider: this.name,
      paymentStatus: this.mapCreemStatus(checkedInvoice),
      paymentInfo: {
        description: checkedOrder?.description,
        amount: checkedOrder?.amount || 0,
        currency: checkedOrder?.currency || '',
        transactionId: checkedOrder?.transaction || checkedOrder?.id,
        discountCode: '',
        discountAmount: checkedOrder?.discount_amount || 0,
        discountCurrency: checkedOrder?.currency || '',
        paymentAmount: checkedOrder?.amount_paid || 0,
        paymentCurrency: checkedOrder?.currency || '',
        paymentEmail: checkedInvoice.customer?.email,
        paymentUserName: checkedInvoice.customer?.name,
        paymentUserId: checkedInvoice.customer?.id,
        paidAt: checkedOrder?.created_at
          ? new Date(checkedOrder.created_at)
          : undefined,
        invoiceId: '', // todo: invoice id
        invoiceUrl: '',
        subscriptionCycleType: cycleType,
      },
      paymentResult: checkedInvoice,
      metadata: checkedInvoice.metadata,
    };

    if (subscription) {
      result.subscriptionId = subscription.id;
      result.subscriptionInfo = await this.buildSubscriptionInfo(
        subscription,
        subscription.product
      );
      result.subscriptionResult = subscription;
    }

    return result;
  }

  // build payment session from subscription
  private async buildPaymentSessionFromSubscription(
    subscription: unknown
  ): Promise<PaymentSession> {
    const checkedSubscription = parseOrThrow(
      creemSubscriptionSchema,
      subscription,
      new WebhookPayloadError('invalid creem subscription payload')
    );

    const result: PaymentSession = {
      provider: this.name,
    };

    result.subscriptionId = checkedSubscription.id;
    result.subscriptionInfo = await this.buildSubscriptionInfo(
      checkedSubscription,
      checkedSubscription.product
    );
    result.subscriptionResult = checkedSubscription;

    return result;
  }

  // build subscription info from subscription
  private async buildSubscriptionInfo(
    subscription: CreemSubscription,
    product?: unknown
  ): Promise<SubscriptionInfo> {
    const parsedProduct = creemProductSchema.safeParse(product);
    const checkedProduct: CreemProduct | undefined = parsedProduct.success
      ? parsedProduct.data
      : undefined;

    const { interval, count: intervalCount } =
      this.mapCreemInterval(checkedProduct);

    const subscriptionInfo: SubscriptionInfo = {
      subscriptionId: subscription.id,
      productId: checkedProduct?.id,
      planId: '',
      description: checkedProduct?.description,
      amount: checkedProduct?.price,
      currency: checkedProduct?.currency,
      currentPeriodStart: new Date(subscription.current_period_start_date),
      currentPeriodEnd: new Date(subscription.current_period_end_date),
      interval: interval,
      intervalCount: intervalCount,
      metadata: subscription.metadata,
    };

    if (subscription.status === 'active') {
      if (subscription.cancel_at) {
        subscriptionInfo.status = SubscriptionStatus.PENDING_CANCEL;
        // cancel apply at
        if (subscription.canceled_at !== undefined) {
          subscriptionInfo.canceledAt = new Date(subscription.canceled_at);
        }
      } else {
        subscriptionInfo.status = SubscriptionStatus.ACTIVE;
      }
    } else if (subscription.status === 'canceled') {
      // subscription canceled
      subscriptionInfo.status = SubscriptionStatus.CANCELED;
      if (subscription.canceled_at !== undefined) {
        subscriptionInfo.canceledAt = new Date(subscription.canceled_at);
      }
    } else if (subscription.status === 'trialing') {
      subscriptionInfo.status = SubscriptionStatus.TRIALING;
    } else if (subscription.status === 'paused') {
      subscriptionInfo.status = SubscriptionStatus.PAUSED;
    } else {
      throw new Error(
        `Unknown Creem subscription status: ${subscription.status}`
      );
    }

    return subscriptionInfo;
  }

  private mapCreemInterval(product: { billing_period?: string } | undefined): {
    interval: PaymentInterval;
    count: number;
  } {
    if (!product || !product.billing_period) {
      throw new Error('Invalid product');
    }

    switch (product.billing_period) {
      case 'every-month':
        return {
          interval: PaymentInterval.MONTH,
          count: 1,
        };
      case 'every-three-months':
        return {
          interval: PaymentInterval.MONTH,
          count: 3,
        };
      case 'every-six-months':
        return {
          interval: PaymentInterval.MONTH,
          count: 6,
        };
      case 'every-year':
        return {
          interval: PaymentInterval.YEAR,
          count: 1,
        };
      case 'once':
        return {
          interval: PaymentInterval.ONE_TIME,
          count: 1,
        };
      default:
        throw new Error(
          `Unknown Creem product billing period: ${product.billing_period}`
        );
    }
  }
}

/**
 * Create Creem provider with configs
 */
export function createCreemProvider(configs: CreemConfigs): CreemProvider {
  return new CreemProvider(configs);
}
