import type Stripe from 'stripe';

import {
  PaymentEventType,
  PaymentType,
  WebhookPayloadError,
  type CheckoutSession,
  type PaymentBilling,
  type PaymentEvent,
  type PaymentInvoice,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
} from '@/domains/billing/domain/payment';
import {
  buildStripeFailedPaymentSessionFromInvoice,
  buildStripePaymentSessionFromCheckoutSession,
  buildStripePaymentSessionFromInvoice,
  buildStripePaymentSessionFromSubscription,
  buildStripeUnknownPaymentEvent,
} from '@/infra/adapters/payment/stripe-mapper';
import {
  StripeTransport,
  type StripeConfigs,
} from '@/infra/adapters/payment/stripe-transport';
import {
  assertSuccessfulPaymentSessionContract,
  mapStripeEventTypeToCanonical,
} from '@/infra/adapters/payment/provider-contract';
import {
  BadRequestError,
  NotFoundError,
  UpstreamError,
} from '@/shared/lib/api/errors';

type StripeCheckoutSessionParams = NonNullable<
  Parameters<Stripe['checkout']['sessions']['create']>[0]
>;
type StripeCheckoutLineItemPriceData = NonNullable<
  NonNullable<StripeCheckoutSessionParams['line_items']>[number]['price_data']
>;
type StripeCheckoutRecurringInterval = NonNullable<
  StripeCheckoutLineItemPriceData['recurring']
>['interval'];

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';
  configs: StripeConfigs;

  private readonly transport: StripeTransport;

  constructor(
    configs: StripeConfigs,
    options?: { transport?: StripeTransport }
  ) {
    this.configs = configs;
    this.transport = options?.transport ?? new StripeTransport(configs);
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (!order.price) {
      throw new BadRequestError('price is required');
    }

    const priceData: StripeCheckoutLineItemPriceData = {
      currency: order.price.currency,
      unit_amount: order.price.amount,
      product_data: {
        name: order.description || '',
      },
    };

    if (order.type === PaymentType.SUBSCRIPTION) {
      if (!order.plan) {
        throw new BadRequestError('plan is required');
      }

      priceData.recurring = {
        interval: order.plan.interval as StripeCheckoutRecurringInterval,
      };
    }

    let customerId = '';
    if (order.customer?.email) {
      const customers = await this.transport.listCustomersByEmail(
        order.customer.email
      );

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      } else {
        const customer = await this.transport.createCustomer({
          email: order.customer.email,
          name: order.customer.name,
          metadata: order.customer.metadata as Stripe.MetadataParam | undefined,
        });
        customerId = customer.id;
      }
    }

    const sessionParams: StripeCheckoutSessionParams = {
      mode:
        order.type === PaymentType.SUBSCRIPTION ? 'subscription' : 'payment',
      line_items: [
        {
          price_data: priceData,
          quantity: 1,
        },
      ],
    };

    const currency = order.price.currency.toLowerCase();
    if (currency === 'cny' && order.type === PaymentType.ONE_TIME) {
      sessionParams.payment_method_types = [];
      sessionParams.payment_method_options = {};

      const allowedPaymentMethods = this.configs.allowedPaymentMethods || [];
      if (allowedPaymentMethods.includes('card')) {
        sessionParams.payment_method_types.push('card');
      }
      if (allowedPaymentMethods.includes('wechat_pay')) {
        sessionParams.payment_method_types.push('wechat_pay');
        sessionParams.payment_method_options.wechat_pay = {
          client: 'web',
        };
      }
      if (allowedPaymentMethods.includes('alipay')) {
        sessionParams.payment_method_types.push('alipay');
        sessionParams.payment_method_options.alipay = {};
      }
      if (allowedPaymentMethods.length === 0) {
        sessionParams.payment_method_types = ['card'];
      }
    }

    if (order.type === PaymentType.ONE_TIME) {
      sessionParams.invoice_creation = {
        enabled: true,
      };
    }

    if (customerId) {
      sessionParams.customer = customerId;
    }
    if (order.metadata) {
      sessionParams.metadata = order.metadata as Stripe.MetadataParam | undefined;
    }
    if (order.successUrl) {
      sessionParams.success_url = order.successUrl;
    }
    if (order.cancelUrl) {
      sessionParams.cancel_url = order.cancelUrl;
    }

    const session = await this.transport.createCheckoutSession(sessionParams);
    if (!session.id || !session.url) {
      throw new UpstreamError(502, 'create payment failed');
    }

    return {
      provider: this.name,
      checkoutParams: sessionParams,
      checkoutInfo: {
        sessionId: session.id,
        checkoutUrl: session.url,
      },
      checkoutResult: session,
      metadata: order.metadata || {},
    };
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    if (!sessionId) {
      throw new BadRequestError('sessionId is required');
    }

    const session = await this.transport.retrieveCheckoutSession(sessionId);
    const paymentSession = await buildStripePaymentSessionFromCheckoutSession({
      provider: this.name,
      session,
      retrieveSubscription: (subscriptionId) =>
        this.transport.retrieveSubscription(subscriptionId),
    });
    this.assertSuccessfulPaymentSession(paymentSession);
    return paymentSession;
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature') as string;
    const event = this.transport.constructWebhookEvent({
      rawBody,
      signature,
    });

    const eventType = this.mapStripeEventType(event.type);

    if (eventType === PaymentEventType.UNKNOWN) {
      return buildStripeUnknownPaymentEvent({
        provider: this.name,
        event,
      });
    }

    let paymentSession: PaymentSession | undefined;

    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      paymentSession = await buildStripePaymentSessionFromCheckoutSession({
        provider: this.name,
        session: event.data.object as Stripe.Response<Stripe.Checkout.Session>,
        retrieveSubscription: (subscriptionId) =>
          this.transport.retrieveSubscription(subscriptionId),
      });
    } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
      paymentSession = await buildStripePaymentSessionFromInvoice({
        provider: this.name,
        invoice: event.data.object as Stripe.Response<Stripe.Invoice>,
        retrieveSubscription: (subscriptionId) =>
          this.transport.retrieveSubscription(subscriptionId),
      });
    } else if (eventType === PaymentEventType.PAYMENT_FAILED) {
      paymentSession = buildStripeFailedPaymentSessionFromInvoice({
        provider: this.name,
        invoice: event.data.object as Stripe.Response<Stripe.Invoice>,
        event,
      });
    } else if (
      eventType === PaymentEventType.SUBSCRIBE_UPDATED ||
      eventType === PaymentEventType.SUBSCRIBE_CANCELED
    ) {
      paymentSession = buildStripePaymentSessionFromSubscription({
        provider: this.name,
        subscription: event.data.object as Stripe.Response<Stripe.Subscription>,
      });
    }

    if (!paymentSession) {
      throw new WebhookPayloadError('invalid webhook event');
    }

    this.assertSuccessfulPaymentSession(paymentSession);
    return {
      eventType,
      eventResult: event,
      paymentSession,
    };
  }

  async getPaymentInvoice({
    invoiceId,
  }: {
    invoiceId: string;
  }): Promise<PaymentInvoice> {
    const invoice = await this.transport.retrieveInvoice(invoiceId);
    if (!invoice.id) {
      throw new NotFoundError('invoice not found');
    }

    return {
      invoiceId: invoice.id,
      invoiceUrl: invoice.hosted_invoice_url || undefined,
      amount: invoice.amount_paid,
      currency: invoice.currency,
    };
  }

  async getPaymentBilling({
    customerId,
    returnUrl,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling> {
    const billing = await this.transport.createBillingPortalSession({
      customerId,
      returnUrl,
    });

    if (!billing.url) {
      throw new UpstreamError(502, 'get billing url failed');
    }

    return {
      billingUrl: billing.url,
    };
  }

  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    if (!subscriptionId) {
      throw new BadRequestError('subscriptionId is required');
    }

    const subscription = await this.transport.cancelSubscription(subscriptionId);
    if (!subscription.canceled_at) {
      throw new UpstreamError(502, 'cancel subscription failed');
    }

    return buildStripePaymentSessionFromSubscription({
      provider: this.name,
      subscription,
    });
  }

  private mapStripeEventType(eventType: string): PaymentEventType {
    return mapStripeEventTypeToCanonical(eventType);
  }

  private assertSuccessfulPaymentSession(session: PaymentSession): void {
    assertSuccessfulPaymentSessionContract(session);
  }
}
