import { z } from 'zod';

import { type PaymentConfigs } from '@/core/payment/domain';
import { verifyAndParseCreemWebhookEvent } from '@/core/payment/providers/creem-webhook';
import { UpstreamError } from '@/shared/lib/api/errors';

export interface CreemConfigs extends PaymentConfigs {
  apiKey: string;
  signingSecret?: string;
  environment?: 'sandbox' | 'production';
}

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
    error: z.unknown().optional(),
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

type CreemFetchJson = <TSchema extends z.ZodTypeAny>(
  url: string,
  init: RequestInit | undefined,
  schema: TSchema,
  options: Record<string, unknown>
) => Promise<z.infer<TSchema>>;

const defaultFetchJson: CreemFetchJson = async (url, init, schema, options) => {
  const { safeFetchJsonWithSchema } = await import('@/shared/lib/fetch/server');
  return await safeFetchJsonWithSchema(url, init, schema, options as never);
};

export class CreemTransport {
  private readonly baseUrl: string;
  private readonly fetchJson: CreemFetchJson;

  constructor(
    private readonly configs: CreemConfigs,
    options?: { fetchJson?: CreemFetchJson }
  ) {
    this.baseUrl =
      configs.environment === 'production'
        ? 'https://api.creem.io'
        : 'https://test-api.creem.io';
    this.fetchJson = options?.fetchJson ?? defaultFetchJson;
  }

  async createCheckout(payload: Record<string, unknown>) {
    return await this.makeRequest(
      '/v1/checkouts',
      'POST',
      creemCreateCheckoutResponseSchema,
      payload
    );
  }

  async getCheckoutSession(sessionId: string) {
    return await this.makeRequest(
      `/v1/checkouts?checkout_id=${sessionId}`,
      'GET',
      creemCheckoutSessionSchema
    );
  }

  async getCustomerBilling(customerId: string) {
    return await this.makeRequest(
      '/v1/customers/billing',
      'POST',
      creemBillingResponseSchema,
      {
        customer_id: customerId,
      }
    );
  }

  async cancelSubscription(subscriptionId: string) {
    return await this.makeRequest(
      `/v1/subscriptions/${subscriptionId}/cancel`,
      'POST',
      creemSubscriptionSchema
    );
  }

  async verifyWebhookEvent(input: {
    rawBody: string;
    signatureHeader: string | null;
  }) {
    return await verifyAndParseCreemWebhookEvent({
      rawBody: input.rawBody,
      signatureHeader: input.signatureHeader,
      signingSecret: this.configs.signingSecret,
    });
  }

  private async makeRequest<TSchema extends z.ZodTypeAny>(
    endpoint: string,
    method: string,
    schema: TSchema,
    data?: Record<string, unknown>
  ): Promise<z.infer<TSchema>> {
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

    try {
      return await this.fetchJson(url, config, schema, {
        timeoutMs: 15000,
        cache: 'no-store',
        errorMessage: 'request creem api failed',
        invalidDataMessage: 'invalid creem json response',
      });
    } catch (error: unknown) {
      throw new UpstreamError(
        502,
        error instanceof Error ? error.message : 'request creem api failed'
      );
    }
  }
}
