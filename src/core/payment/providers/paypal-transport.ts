import { z } from 'zod';

import {
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentConfigs,
} from '@/core/payment/domain';
import { UpstreamError } from '@/shared/lib/api/errors';
import { safeJsonParse } from '@/shared/lib/json';

export interface PayPalConfigs extends PaymentConfigs {
  clientId: string;
  clientSecret: string;
  webhookId?: string;
  environment?: 'sandbox' | 'production';
}

const payPalAccessTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    expires_in: z.number().positive(),
  })
  .passthrough();

export const payPalApiResponseSchema = z
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

export const payPalWebhookEventSchema = z
  .object({
    event_type: z.string().min(1),
    id: z.string().optional(),
    resource_type: z.string().optional(),
    resource: z.unknown().optional(),
  })
  .passthrough();

type PayPalFetchJson = <TSchema extends z.ZodTypeAny>(
  url: string,
  init: RequestInit | undefined,
  schema: TSchema,
  options: Record<string, unknown>
) => Promise<z.infer<TSchema>>;

const defaultFetchJson: PayPalFetchJson = async (url, init, schema, options) => {
  const { safeFetchJsonWithSchema } = await import('@/shared/lib/fetch/server');
  return await safeFetchJsonWithSchema(url, init, schema, options as never);
};

export class PayPalTransport {
  private readonly baseUrl: string;
  private accessToken?: string;
  private tokenExpiry?: number;
  private readonly fetchJson: PayPalFetchJson;
  private readonly now: () => number;

  constructor(
    private readonly configs: PayPalConfigs,
    options?: {
      fetchJson?: PayPalFetchJson;
      now?: () => number;
    }
  ) {
    this.baseUrl =
      configs.environment === 'production'
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';
    this.fetchJson = options?.fetchJson ?? defaultFetchJson;
    this.now = options?.now ?? Date.now;
  }

  async createOrder(payload: Record<string, unknown>) {
    return await this.makeRequest('/v2/checkout/orders', 'POST', payload);
  }

  async createProduct(payload: Record<string, unknown>) {
    return await this.makeRequest('/v1/catalogs/products', 'POST', payload);
  }

  async createPlan(payload: Record<string, unknown>) {
    return await this.makeRequest('/v1/billing/plans', 'POST', payload);
  }

  async createSubscription(payload: Record<string, unknown>) {
    return await this.makeRequest('/v1/billing/subscriptions', 'POST', payload);
  }

  async getOrder(sessionId: string) {
    return await this.makeRequest(`/v2/checkout/orders/${sessionId}`, 'GET');
  }

  async getSubscription(subscriptionId: string) {
    return await this.makeRequest(
      `/v1/billing/subscriptions/${subscriptionId}`,
      'GET'
    );
  }

  parseWebhookEvent(rawBody: string) {
    const event = safeJsonParse<unknown>(rawBody);
    if (event === null) {
      throw new WebhookPayloadError('invalid webhook payload');
    }

    const parsedEvent = payPalWebhookEventSchema.safeParse(event);
    if (!parsedEvent.success) {
      throw new WebhookPayloadError('invalid webhook payload');
    }

    return parsedEvent.data;
  }

  async verifyWebhookSignature(input: {
    headers: Record<string, string | undefined>;
    webhookEvent: z.infer<typeof payPalWebhookEventSchema>;
  }) {
    if (!this.configs.webhookId) {
      throw new WebhookConfigError('paypal webhook id not configured');
    }

    const verifyPayload = {
      auth_algo: input.headers['paypal-auth-algo'],
      cert_id: input.headers['paypal-cert-id'],
      transmission_id: input.headers['paypal-transmission-id'],
      transmission_sig: input.headers['paypal-transmission-sig'],
      transmission_time: input.headers['paypal-transmission-time'],
      webhook_id: this.configs.webhookId,
      webhook_event: input.webhookEvent,
    };

    const verifyResponse = await this.makeRequest(
      '/v1/notifications/verify-webhook-signature',
      'POST',
      verifyPayload
    );

    if (verifyResponse.verification_status !== 'SUCCESS') {
      throw new WebhookVerificationError('invalid webhook signature');
    }

    return verifyResponse;
  }

  private async ensureAccessToken() {
    if (this.accessToken && this.tokenExpiry && this.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const credentials = btoa(
      `${this.configs.clientId}:${this.configs.clientSecret}`
    );

    try {
      const data = await this.fetchJson(
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
      this.tokenExpiry = this.now() + data.expires_in * 1000;
      return this.accessToken;
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
  ) {
    const accessToken = await this.ensureAccessToken();
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
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
      return await this.fetchJson(url, config, payPalApiResponseSchema, {
        timeoutMs: 15000,
        cache: 'no-store',
        errorMessage: 'PayPal request failed',
        invalidDataMessage: 'invalid PayPal json response',
      });
    } catch (error: unknown) {
      throw new UpstreamError(
        502,
        error instanceof Error ? error.message : 'PayPal request failed'
      );
    }
  }
}
