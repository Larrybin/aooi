import { z } from 'zod';

import { safeFetch } from '@/shared/lib/fetch/server';
import { logger } from '@/shared/lib/logger.server';

import {
  CheckoutSession,
  PaymentConfigs,
  PaymentEvent,
  PaymentEventType,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
} from '.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
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
  webhookSecret?: string;
  environment?: 'sandbox' | 'production';
}

/**
 * PayPal payment provider implementation
 * @website https://www.paypal.com/
 */
export class PayPalProvider implements PaymentProvider {
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
  }): Promise<CheckoutSession> {
    await this.ensureAccessToken();

    if (!order.price) {
      throw new Error('price is required');
    }

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

    if (result.error) {
      throw new Error(result.error.message || 'PayPal payment creation failed');
    }

    const approvalUrl = result.links?.find(
      (link: { rel: string }) => link.rel === 'approve'
    )?.href;

    return {
      provider: this.name,
      checkoutParams: payload,
      checkoutInfo: {
        sessionId: result.id,
        checkoutUrl: approvalUrl,
      },
      checkoutResult: result,
      metadata: order.metadata || {},
    };
  }

  async createSubscriptionPayment(
    order: PaymentOrder
  ): Promise<CheckoutSession> {
    await this.ensureAccessToken();

    if (!order.plan) {
      throw new Error('plan is required');
    }

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

    if (productResponse.error) {
      throw new Error(
        productResponse.error.message || 'PayPal product creation failed'
      );
    }

    // Create a billing plan
    const planPayload = {
      product_id: productResponse.id,
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
              value: order.price?.amount.toFixed(2),
              currency_code: order.price?.currency.toUpperCase(),
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
            currency_code: order.price?.currency.toUpperCase(),
          },
        },
      });
    }

    const planResponse = await this.makeRequest(
      '/v1/billing/plans',
      'POST',
      planPayload
    );

    if (planResponse.error) {
      throw new Error(
        planResponse.error.message || 'PayPal plan creation failed'
      );
    }

    // Create subscription
    const subscriptionPayload = {
      plan_id: planResponse.id,
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

    if (subscriptionResponse.error) {
      throw new Error(
        subscriptionResponse.error.message ||
          'PayPal subscription creation failed'
      );
    }

    const approvalUrl = subscriptionResponse.links?.find(
      (link: { rel: string }) => link.rel === 'approve'
    )?.href;

    return {
      provider: this.name,
      checkoutParams: subscriptionPayload,
      checkoutInfo: {
        sessionId: subscriptionResponse.id,
        checkoutUrl: approvalUrl,
      },
      checkoutResult: subscriptionResponse,
      metadata: order.metadata || {},
    };
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId?: string;
  }): Promise<PaymentSession> {
    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    await this.ensureAccessToken();

    // Try to get as order first, then as subscription
    let result = await this.makeRequest(
      `/v2/checkout/orders/${sessionId}`,
      'GET'
    );

    if (result.error && result.error.name === 'RESOURCE_NOT_FOUND') {
      // Try as subscription
      result = await this.makeRequest(
        `/v1/billing/subscriptions/${sessionId}`,
        'GET'
      );
    }

    if (result.error) {
      throw new Error(result.error.message || 'get payment failed');
    }

    const transactionId = extractPayPalTransactionId(result);
    const invoiceId = extractPayPalInvoiceId(result);

    return {
      provider: this.name,
      paymentStatus: this.mapPayPalStatus(result.status),
      paymentInfo: {
        discountCode: '',
        discountAmount: undefined,
        discountCurrency: undefined,
        transactionId,
        paymentAmount: result.amount,
        paymentCurrency: result.currency,
        paymentEmail: result.customer_email,
        invoiceId,
        paidAt: new Date(),
      },
      paymentResult: result,
      metadata: result.metadata,
    };
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const headers = Object.fromEntries(req.headers.entries());

    if (!this.configs.webhookSecret) {
      throw new WebhookConfigError('webhookSecret not configured');
    }

    let event: unknown;
    try {
      event = JSON.parse(rawBody);
    } catch {
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
      webhook_id: this.configs.webhookSecret,
      webhook_event: webhookEvent,
    };

    const verifyResponse = await this.makeRequest(
      '/v1/notifications/verify-webhook-signature',
      'POST',
      verifyPayload
    );

    if (verifyResponse.verification_status !== 'SUCCESS') {
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

    const mappedEventType = this.mapPayPalEventType(webhookEvent.event_type);
    if (!mappedEventType) {
      throw new WebhookPayloadError(
        `unsupported paypal webhook event type: ${webhookEvent.event_type}`
      );
    }

    return {
      eventType: mappedEventType,
      eventResult: webhookEvent,
      paymentSession: undefined,
    };
  }

  private async ensureAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return;
    }

    const credentials = Buffer.from(
      `${this.configs.clientId}:${this.configs.clientSecret}`
    ).toString('base64');

    const response = await safeFetch(
      `${this.baseUrl}/v1/oauth2/token`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
      { timeoutMs: 15000, cache: 'no-store' }
    );

    const data = await response.json();

    if (!response.ok) {
      const detail =
        typeof data?.error_description === 'string' &&
        data.error_description.trim()
          ? data.error_description.trim()
          : typeof data?.error === 'string' && data.error.trim()
            ? data.error.trim()
            : `status ${response.status}`;
      throw new Error(`PayPal authentication failed: ${detail}`);
    }

    if (data.error) {
      throw new Error(
        `PayPal authentication failed: ${data.error_description}`
      );
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
  }

  private async makeRequest(
    endpoint: string,
    method: string,
    data?: Record<string, unknown>
  ) {
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

    const response = await safeFetch(url, config, {
      timeoutMs: 15000,
      cache: 'no-store',
    });
    if (!response.ok) {
      const result = await response.json();
      let errorMessage = result.name;
      if (result.details) {
        errorMessage += `: ${result.details
          .map((detail: { issue: string }) => detail.issue)
          .join(', ')}`;
      }
      throw new Error(`PayPal request failed: ${errorMessage}`);
    }

    return await response.json();
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
      case 'EXPIRED':
        return PaymentStatus.CANCELED;
      case 'SUSPENDED':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PROCESSING;
    }
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
