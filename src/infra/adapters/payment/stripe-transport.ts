import {
  WebhookConfigError,
  WebhookVerificationError,
  type PaymentConfigs,
} from '@/domains/billing/domain/payment';
import Stripe from 'stripe';

export interface StripeConfigs extends PaymentConfigs {
  secretKey: string;
  publishableKey: string;
  signingSecret?: string;
  apiVersion?: string;
  allowedPaymentMethods?: string[];
}

type StripeClientLike = Pick<
  Stripe,
  | 'checkout'
  | 'customers'
  | 'invoices'
  | 'billingPortal'
  | 'subscriptions'
  | 'webhooks'
>;
type StripeCheckoutSessionParams = NonNullable<
  Parameters<StripeClientLike['checkout']['sessions']['create']>[0]
>;

export class StripeTransport {
  private readonly client: StripeClientLike;

  constructor(
    private readonly configs: StripeConfigs,
    options?: { client?: StripeClientLike }
  ) {
    this.client =
      options?.client ??
      new Stripe(configs.secretKey, {
        httpClient: Stripe.createFetchHttpClient(),
      });
  }

  async listCustomersByEmail(email: string) {
    return await this.client.customers.list({
      email,
      limit: 1,
    });
  }

  async createCustomer(input: Stripe.CustomerCreateParams) {
    return await this.client.customers.create(input);
  }

  async createCheckoutSession(input: StripeCheckoutSessionParams) {
    return await this.client.checkout.sessions.create(input);
  }

  async retrieveCheckoutSession(sessionId: string) {
    return await this.client.checkout.sessions.retrieve(sessionId);
  }

  async retrieveSubscription(subscriptionId: string) {
    return await this.client.subscriptions.retrieve(subscriptionId);
  }

  async retrieveInvoice(invoiceId: string) {
    return await this.client.invoices.retrieve(invoiceId);
  }

  async createBillingPortalSession(input: {
    customerId: string;
    returnUrl?: string;
  }) {
    return await this.client.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
  }

  async cancelSubscription(subscriptionId: string) {
    return await this.client.subscriptions.cancel(subscriptionId);
  }

  constructWebhookEvent(input: { rawBody: string; signature: string }) {
    if (!input.rawBody || !input.signature) {
      throw new WebhookVerificationError('invalid webhook request');
    }

    if (!this.configs.signingSecret) {
      throw new WebhookConfigError('signing secret not configured');
    }

    try {
      return this.client.webhooks.constructEvent(
        input.rawBody,
        input.signature,
        this.configs.signingSecret
      );
    } catch {
      throw new WebhookVerificationError('invalid webhook signature');
    }
  }
}
