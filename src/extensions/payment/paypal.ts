import { z } from 'zod';

import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';
import { safeFetchJsonWithSchema } from '@/shared/lib/fetch/server';
import { safeJsonParse } from '@/shared/lib/json';
import { logger } from '@/shared/lib/logger.server';

import {
  PaymentEventType,
  PaymentStatus,
  PaymentType,
  SubscriptionStatus,
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentConfigs,
  type PaymentOrder,
  type PaymentProviderDriver,
  type RawCheckoutSession,
  type RawPaymentEvent,
  type RawPaymentSession,
  type SubscriptionInfo,
} from '.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const asNumber = Number(trimmed);
    return Number.isFinite(asNumber) ? asNumber : undefined;
  }
  return undefined;
}

function readPath(root: unknown, path: string[]): unknown {
  let current: unknown = root;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }

    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function readStringPath(root: unknown, path: string[]): string | undefined {
  return readString(readPath(root, path));
}

function readNumberPath(root: unknown, path: string[]): number | undefined {
  return readNumber(readPath(root, path));
}

function readDateTime(value: unknown): Date | undefined {
  const stringValue = readString(value);
  if (!stringValue) return undefined;

  const parsed = new Date(stringValue);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function readDateTimePath(root: unknown, path: string[]): Date | undefined {
  return readDateTime(readPath(root, path));
}

const payPalAccessTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().positive(),
  })
  .passthrough();

const payPalApiResponseSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    links: z
      .array(
        z
          .object({
            rel: z.string().min(1),
            href: z.string().optional(),
          })
          .passthrough()
      )
      .optional(),
    error: z
      .object({
        name: z.string().optional(),
        message: z.string().optional(),
        details: z.array(z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    name: z.string().optional(),
    message: z.string().optional(),
    details: z.array(z.unknown()).optional(),
    verification_status: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

function extractApprovalUrl(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const links = payload.links;
  if (!Array.isArray(links)) return undefined;

  for (const link of links) {
    if (!isRecord(link)) continue;
    if (readString(link.rel) === 'approve') {
      return readString(link.href);
    }
  }

  return undefined;
}

function extractPayPalStatus(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  return readString(payload.status);
}

function extractPayPalAmount(payload: unknown): number | undefined {
  return (
    readNumberPath(payload, ['amount']) ??
    readNumberPath(payload, ['purchase_units', '0', 'amount', 'value']) ??
    readNumberPath(payload, ['billing_info', 'last_payment', 'amount', 'value'])
  );
}

function extractPayPalCurrency(payload: unknown): string | undefined {
  return (
    readStringPath(payload, ['currency']) ??
    readStringPath(payload, [
      'purchase_units',
      '0',
      'amount',
      'currency_code',
    ]) ??
    readStringPath(payload, [
      'billing_info',
      'last_payment',
      'amount',
      'currency_code',
    ])
  );
}

function extractPayPalCustomerEmail(payload: unknown): string | undefined {
  return (
    readStringPath(payload, ['customer_email']) ??
    readStringPath(payload, ['payer', 'email_address']) ??
    readStringPath(payload, ['subscriber', 'email_address'])
  );
}

function extractPayPalOrderNo(payload: unknown): string | undefined {
  return (
    readStringPath(payload, ['custom_id']) ??
    readStringPath(payload, ['purchase_units', '0', 'custom_id']) ??
    readStringPath(payload, ['purchase_units', '0', 'invoice_id'])
  );
}

function extractPayPalMetadata(
  payload: unknown
): Record<string, unknown> | undefined {
  const value = readPath(payload, ['metadata']);
  const metadata = isRecord(value) ? value : undefined;

  const orderNo = extractPayPalOrderNo(payload);
  if (!metadata && !orderNo) return undefined;

  return {
    ...(metadata || {}),
    ...(orderNo ? { order_no: orderNo } : {}),
  };
}

function extractPayPalTransactionId(result: unknown): string | undefined {
  // Subscription API surface: billing_info.last_payment.transaction_id
  const fromLastPayment = readStringPath(result, [
    'billing_info',
    'last_payment',
    'transaction_id',
  ]);
  if (fromLastPayment) return fromLastPayment;

  // Orders API surface: purchase_units[0].payments.captures[0].id / sales[0].id
  const fromCapture = readStringPath(result, [
    'purchase_units',
    '0',
    'payments',
    'captures',
    '0',
    'id',
  ]);
  if (fromCapture) return fromCapture;

  const fromSale = readStringPath(result, [
    'purchase_units',
    '0',
    'payments',
    'sales',
    '0',
    'id',
  ]);
  if (fromSale) return fromSale;

  return undefined;
}

function extractPayPalInvoiceId(result: unknown): string | undefined {
  return (
    readStringPath(result, ['invoice_id']) ||
    readStringPath(result, ['purchase_units', '0', 'invoice_id'])
  );
}

type PayPalSubscriptionEventType =
  | PaymentEventType.SUBSCRIBE_UPDATED
  | PaymentEventType.SUBSCRIBE_CANCELED;

const payPalWebhookEventSchema = z
  .object({
    event_type: z.string().min(1),
    id: z.string().optional(),
    resource_type: z.string().optional(),
    resource: z.unknown().optional(),
  })
  .passthrough();

const payPalWebhookResourceSummarySchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
  })
  .passthrough();

/**
 * PayPal payment provider configs
 * @docs https://developer.paypal.com/docs/
 */
export interface PayPalConfigs extends PaymentConfigs {
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * PayPal payment provider implementation
 * @website https://www.paypal.com/
 */
export class PayPalProvider implements PaymentProviderDriver {
  readonly name = 'paypal';
  configs: PayPalConfigs;

  private baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(configs: PayPalConfigs) {
    this.configs = configs;
    this.baseUrl =
      configs.environment === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
  }

  // create payment
  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<RawCheckoutSession> {
    if (order.type === PaymentType.SUBSCRIPTION) {
      return this.createSubscriptionPayment(order);
    }

    await this.ensureAccessToken();

    if (!order.price) {
      throw new BadRequestError('price is required');
    }

    const orderNo =
      order.metadata && typeof order.metadata.order_no === 'string'
        ? order.metadata.order_no
        : undefined;

    const items = [
      {
        name: order.description || 'Payment',
        unit_amount: {
          currency_code: order.price.currency.toUpperCase(),
          value: (order.price.amount / 100).toFixed(2), // unit: dollars
        },
        quantity: '1',
      },
    ];

    const totalAmount = items.reduce(
      (sum, item) => sum + parseFloat(item.unit_amount.value),
      0
    );

    const payload = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          items,
          custom_id: orderNo,
          amount: {
            currency_code: order.price.currency.toUpperCase(),
            value: totalAmount.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: order.price.currency.toUpperCase(),
                value: totalAmount.toFixed(2),
              },
            },
          },
        },
      ],
      application_context: {
        return_url: order.successUrl,
        cancel_url: order.cancelUrl,
        user_action: 'PAY_NOW',
      },
    };

    const result = await this.makeRequest(
      '/v2/checkout/orders',
      'POST',
      payload
    );

    const maybeErrorMessage = readStringPath(result, ['error', 'message']);
    if (maybeErrorMessage) {
      throw new UpstreamError(502, maybeErrorMessage);
    }

    const approvalUrl = extractApprovalUrl(result);
    if (!approvalUrl) {
      throw new UpstreamError(
        502,
        'PayPal order creation failed: missing approve url'
      );
    }
    const sessionId = readStringPath(result, ['id']);
    if (!sessionId) {
      throw new UpstreamError(502, 'PayPal order creation failed: missing id');
    }

    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId,
        checkoutUrl: approvalUrl,
      },
      checkoutResult: result,
      metadata: order.metadata || {},
    };
  }

  async createSubscriptionPayment(
    order: PaymentOrder
  ): Promise<RawCheckoutSession> {
    await this.ensureAccessToken();

    if (!order.price) {
      throw new BadRequestError('price is required');
    }

    if (!order.plan) {
      throw new BadRequestError('plan is required');
    }

    const orderNo =
      order.metadata && typeof order.metadata.order_no === 'string'
        ? order.metadata.order_no
        : undefined;

    // First create a product
    const productPayload = {
      name: order.plan.name,
      description: order.plan.description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    };

    const productResponse = await this.makeRequest(
      '/v1/catalogs/products',
      'POST',
      productPayload
    );

    const productErrorMessage = readStringPath(productResponse, [
      'error',
      'message',
    ]);
    if (productErrorMessage) {
      throw new UpstreamError(502, productErrorMessage);
    }
    const productId = readStringPath(productResponse, ['id']);
    if (!productId) {
      throw new UpstreamError(
        502,
        'PayPal product creation failed: missing id'
      );
    }

    // Create a billing plan
    const currencyCode = order.price.currency.toUpperCase();
    const planAmount = (order.price.amount / 100).toFixed(2);

    const planPayload = {
      product_id: productId,
      name: order.plan.name,
      description: order.plan.description,
      billing_cycles: [
        {
          frequency: {
            interval_unit: order.plan.interval.toUpperCase(),
            interval_count: order.plan.intervalCount || 1,
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite
          pricing_scheme: {
            fixed_price: {
              value: planAmount,
              currency_code: currencyCode,
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3,
      },
    };

    // Add trial period if specified
    if (order.plan?.trialPeriodDays) {
      planPayload.billing_cycles.unshift({
        frequency: {
          interval_unit: 'DAY',
          interval_count: 1,
        },
        tenure_type: 'TRIAL',
        sequence: 0,
        total_cycles: order.plan?.trialPeriodDays || 0,
        pricing_scheme: {
          fixed_price: {
            value: '0.00',
            currency_code: currencyCode,
          },
        },
      });
    }

    const planResponse = await this.makeRequest(
      '/v1/billing/plans',
      'POST',
      planPayload
    );

    const planErrorMessage = readStringPath(planResponse, ['error', 'message']);
    if (planErrorMessage) {
      throw new UpstreamError(502, planErrorMessage);
    }
    const planId = readStringPath(planResponse, ['id']);
    if (!planId) {
      throw new UpstreamError(502, 'PayPal plan creation failed: missing id');
    }

    // Create subscription
    const subscriptionPayload = {
      plan_id: planId,
      custom_id: orderNo,
      subscriber: {
        email_address: order.customer?.email,
        name: order.customer?.name
          ? {
              given_name: order.customer?.name.split(' ')[0],
              surname: order.customer?.name.split(' ').slice(1).join(' '),
            }
          : undefined,
      },
      application_context: {
        brand_name: 'Your Brand',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED',
        },
        return_url: order.successUrl,
        cancel_url: order.cancelUrl,
      },
    };

    const subscriptionResponse = await this.makeRequest(
      '/v1/billing/subscriptions',
      'POST',
      subscriptionPayload
    );

    const subscriptionErrorMessage = readStringPath(subscriptionResponse, [
      'error',
      'message',
    ]);
    if (subscriptionErrorMessage) {
      throw new UpstreamError(502, subscriptionErrorMessage);
    }

    const approvalUrl = extractApprovalUrl(subscriptionResponse);
    if (!approvalUrl) {
      throw new UpstreamError(
        502,
        'PayPal subscription creation failed: missing approve url'
      );
    }
    const sessionId = readStringPath(subscriptionResponse, ['id']);
    if (!sessionId) {
      throw new UpstreamError(
        502,
        'PayPal subscription creation failed: missing id'
      );
    }

    return {
      provider: this.name,
      checkoutParams: subscriptionPayload,
      checkoutInfo: {
        sessionId,
        checkoutUrl: approvalUrl,
      },
      checkoutResult: subscriptionResponse,
      metadata: order.metadata || {},
    };
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<RawPaymentSession> {
    if (!sessionId) {
      throw new BadRequestError('sessionId is required');
    }

    await this.ensureAccessToken();

    // Try to get as order first, then as subscription
    let result = await this.makeRequest(
      `/v2/checkout/orders/${sessionId}`,
      'GET'
    );

    if (readStringPath(result, ['name']) === 'RESOURCE_NOT_FOUND') {
      // Try as subscription
      result = await this.makeRequest(
        `/v1/billing/subscriptions/${sessionId}`,
        'GET'
      );
    }

    const errorMessage = readStringPath(result, ['error', 'message']);
    if (errorMessage) {
      throw new UpstreamError(502, errorMessage);
    }

    const transactionId = extractPayPalTransactionId(result);
    const invoiceId = extractPayPalInvoiceId(result);

    return {
      provider: this.name,
      paymentStatus: this.mapPayPalStatus(
        extractPayPalStatus(result) || 'CREATED'
      ),
      paymentInfo: {
        discountCode: '',
        discountAmount: undefined,
        discountCurrency: undefined,
        transactionId,
        paymentAmount: extractPayPalAmount(result) || 0,
        paymentCurrency: extractPayPalCurrency(result) || '',
        paymentEmail: extractPayPalCustomerEmail(result),
        invoiceId,
        paidAt: new Date(),
      },
      paymentResult: result,
      metadata: extractPayPalMetadata(result),
    };
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<RawPaymentEvent> {
    const rawBody = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    if (!this.configs.webhookId) {
      throw new WebhookConfigError('paypal webhook id not configured');
    }

    const event = safeJsonParse<unknown>(rawBody);
    if (event === null) {
      throw new WebhookPayloadError('invalid webhook payload');
    }

    const parsedEvent = payPalWebhookEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      throw new WebhookPayloadError('invalid webhook payload');
    }
    const webhookEvent = parsedEvent.data;

    // verify webhook with PayPal (simplified verification)
    await this.ensureAccessToken();

    const verifyPayload = {
      auth_algo: headers?.['paypal-auth-algo'],
      cert_id: headers?.['paypal-cert-id'],
      transmission_id: headers?.['paypal-transmission-id'],
      transmission_sig: headers?.['paypal-transmission-sig'],
      transmission_time: headers?.['paypal-transmission-time'],
      webhook_id: this.configs.webhookId,
      webhook_event: webhookEvent,
    };

    const verifyResponse = await this.makeRequest(
      '/v1/notifications/verify-webhook-signature',
      'POST',
      verifyPayload
    );

    if (readStringPath(verifyResponse, ['verification_status']) !== 'SUCCESS') {
      throw new WebhookVerificationError('invalid webhook signature');
    }

    // Process the webhook event
    logger.debug('paypal webhook event received', {
      eventType: webhookEvent.event_type,
      eventId: webhookEvent.id,
      resourceType: webhookEvent.resource_type,
    });

    const resourceSummary = payPalWebhookResourceSummarySchema.safeParse(
      webhookEvent.resource
    );
    logger.debug('paypal webhook resource summary', {
      resourceId: resourceSummary.success ? resourceSummary.data.id : undefined,
      resourceStatus: resourceSummary.success
        ? resourceSummary.data.status
        : undefined,
      hasResource: Boolean(webhookEvent.resource),
    });

    const mappedEventType =
      this.mapPayPalEventType(webhookEvent.event_type) ??
      PaymentEventType.PAYMENT_FAILED;

    let paymentSession: RawPaymentSession | undefined = undefined;
    const resourceId = readStringPath(webhookEvent.resource, ['id']);

    if (mappedEventType === PaymentEventType.CHECKOUT_SUCCESS) {
      if (!resourceId) {
        throw new WebhookPayloadError('missing paypal resource id');
      }
      paymentSession = await this.getPaymentSession({ sessionId: resourceId });
    } else if (
      mappedEventType === PaymentEventType.SUBSCRIBE_UPDATED ||
      mappedEventType === PaymentEventType.SUBSCRIBE_CANCELED
    ) {
      if (!resourceId) {
        throw new WebhookPayloadError('missing paypal subscription id');
      }
      paymentSession = await this.getSubscriptionSession({
        subscriptionId: resourceId,
        eventType: mappedEventType,
      });
    } else {
      paymentSession = {
        provider: this.name,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: webhookEvent.resource ?? webhookEvent,
      };
    }
    if (!paymentSession) {
      throw new WebhookPayloadError('payment session not found');
    }

    return {
      eventType: mappedEventType,
      eventResult: webhookEvent,
      paymentSession,
    };
  }

  private async ensureAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return;
    }

    const credentials = Buffer.from(
      `${this.configs.clientId}:${this.configs.clientSecret}`
    ).toString('base64');

    try {
      const data = await safeFetchJsonWithSchema(
        `${this.baseUrl}/v1/oauth2/token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        },
        payPalAccessTokenResponseSchema,
        {
          timeoutMs: 15000,
          cache: 'no-store',
          errorMessage: 'PayPal authentication failed',
          invalidDataMessage: 'invalid PayPal authentication response',
        }
      );

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + data.expires_in * 1000;
    } catch (error: unknown) {
      throw new UpstreamError(
        502,
        error instanceof Error ? error.message : 'PayPal authentication failed'
      );
    }
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    data?: Record<string, unknown>
  ): Promise<z.infer<typeof payPalApiResponseSchema>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      method,
      headers,
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      return await safeFetchJsonWithSchema(
        url,
        config,
        payPalApiResponseSchema,
        {
          timeoutMs: 15000,
          cache: 'no-store',
          errorMessage: 'PayPal request failed',
          invalidDataMessage: 'invalid PayPal json response',
        }
      );
    } catch (error: unknown) {
      throw new UpstreamError(
        502,
        error instanceof Error ? error.message : 'PayPal request failed'
      );
    }
  }

  private mapPayPalStatus(status: string): PaymentStatus {
    switch (status) {
      case 'CREATED':
      case 'SAVED':
      case 'APPROVED':
        return PaymentStatus.PROCESSING;
      case 'COMPLETED':
      case 'ACTIVE':
        return PaymentStatus.SUCCESS;
      case 'CANCELED':
      case 'CANCELLED':
      case 'EXPIRED':
        return PaymentStatus.CANCELED;
      case 'SUSPENDED':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PROCESSING;
    }
  }

  private mapPayPalSubscriptionStatus(
    status: string
  ): SubscriptionStatus | undefined {
    switch (status) {
      case 'ACTIVE':
        return SubscriptionStatus.ACTIVE;
      case 'SUSPENDED':
        return SubscriptionStatus.PAUSED;
      case 'CANCELLED':
        return SubscriptionStatus.CANCELED;
      case 'EXPIRED':
        return SubscriptionStatus.EXPIRED;
      case 'APPROVAL_PENDING':
      case 'APPROVED':
        return SubscriptionStatus.TRIALING;
      default:
        return undefined;
    }
  }

  private buildSubscriptionInfoFromPayPalSubscription({
    subscription,
    subscriptionId,
    eventType,
  }: {
    subscription: unknown;
    subscriptionId: string;
    eventType: PayPalSubscriptionEventType;
  }): SubscriptionInfo {
    const statusValue = readStringPath(subscription, ['status']);
    const mappedStatus = statusValue
      ? this.mapPayPalSubscriptionStatus(statusValue)
      : undefined;

    const status =
      eventType === PaymentEventType.SUBSCRIBE_CANCELED
        ? SubscriptionStatus.CANCELED
        : (mappedStatus ?? SubscriptionStatus.ACTIVE);

    const currentPeriodStart =
      readDateTimePath(subscription, [
        'billing_info',
        'last_payment',
        'time',
      ]) ??
      readDateTimePath(subscription, ['start_time']) ??
      new Date();

    const currentPeriodEnd =
      readDateTimePath(subscription, ['billing_info', 'next_billing_time']) ??
      readDateTimePath(subscription, ['billing_info', 'final_payment_time']) ??
      currentPeriodStart;

    const subscriptionInfo: SubscriptionInfo = {
      subscriptionId,
      planId: readStringPath(subscription, ['plan_id']) ?? undefined,
      currentPeriodStart,
      currentPeriodEnd,
      status,
    };

    if (status === SubscriptionStatus.CANCELED) {
      const canceledAt =
        readDateTimePath(subscription, ['status_update_time']) ??
        readDateTimePath(subscription, ['update_time']) ??
        new Date();

      subscriptionInfo.canceledAt = canceledAt;

      const canceledEndAt =
        readDateTimePath(subscription, [
          'billing_info',
          'final_payment_time',
        ]) ??
        readDateTimePath(subscription, ['billing_info', 'next_billing_time']);

      if (canceledEndAt) {
        subscriptionInfo.canceledEndAt = canceledEndAt;
      } else if (currentPeriodEnd.getTime() >= canceledAt.getTime()) {
        subscriptionInfo.canceledEndAt = currentPeriodEnd;
      }
    }

    return subscriptionInfo;
  }

  private async getSubscriptionSession({
    subscriptionId,
    eventType,
  }: {
    subscriptionId: string;
    eventType: PayPalSubscriptionEventType;
  }): Promise<RawPaymentSession> {
    const subscription = await this.makeRequest(
      `/v1/billing/subscriptions/${subscriptionId}`,
      'GET'
    );

    const subscriptionInfo = this.buildSubscriptionInfoFromPayPalSubscription({
      subscription,
      subscriptionId,
      eventType,
    });

    return {
      provider: this.name,
      paymentStatus: this.mapPayPalStatus(
        extractPayPalStatus(subscription) || ''
      ),
      subscriptionId,
      subscriptionInfo,
      subscriptionResult: subscription,
      metadata: extractPayPalMetadata(subscription),
    };
  }

  private mapPayPalEventType(eventType: string): PaymentEventType | undefined {
    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'CHECKOUT.ORDER.COMPLETED':
        return PaymentEventType.CHECKOUT_SUCCESS;
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'PAYMENT.SALE.COMPLETED':
        return PaymentEventType.PAYMENT_SUCCESS;
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED':
      case 'PAYMENT.SALE.DENIED':
        return PaymentEventType.PAYMENT_FAILED;
      case 'BILLING.SUBSCRIPTION.UPDATED':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'BILLING.SUBSCRIPTION.CANCELLED':
        return PaymentEventType.SUBSCRIBE_CANCELED;
      default:
        return undefined;
    }
  }
}

/**
 * Create PayPal provider with configs
 */
export function createPayPalProvider(configs: PayPalConfigs): PayPalProvider {
  return new PayPalProvider(configs);
}
