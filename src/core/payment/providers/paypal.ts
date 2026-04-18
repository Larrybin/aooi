import {
  PaymentEventType,
  PaymentStatus,
  PaymentType,
  WebhookPayloadError,
  type CheckoutSession,
  type PaymentEvent,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
} from '@/core/payment/domain';
import {
  buildPayPalPaymentSession,
  buildPayPalWebhookPaymentSession,
  buildPayPalSubscriptionSession,
  extractApprovalUrl,
  extractPayPalWebhookSubscriptionId,
  mergePayPalRenewalSubscription,
  readStringPath,
} from '@/core/payment/providers/paypal-mapper';
import {
  PayPalTransport,
  type PayPalConfigs,
} from '@/core/payment/providers/paypal-transport';
import {
  assertSuccessfulPaymentSessionContract,
  mapPayPalEventTypeToCanonical,
} from '@/core/payment/providers/provider-contract';
import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';

type PayPalSubscriptionEventType =
  | PaymentEventType.SUBSCRIBE_UPDATED
  | PaymentEventType.SUBSCRIBE_CANCELED;

export class PayPalProvider implements PaymentProvider {
  readonly name = 'paypal';
  configs: PayPalConfigs;

  private readonly transport: PayPalTransport;

  constructor(
    configs: PayPalConfigs,
    options?: { transport?: PayPalTransport }
  ) {
    this.configs = configs;
    this.transport = options?.transport ?? new PayPalTransport(configs);
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (order.type === PaymentType.SUBSCRIPTION) {
      return await this.createSubscriptionPayment(order);
    }

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
          value: (order.price.amount / 100).toFixed(2),
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

    const result = await this.transport.createOrder(payload);
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
  ): Promise<CheckoutSession> {
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

    const productPayload = {
      name: order.plan.name,
      description: order.plan.description,
      type: 'SERVICE',
      category: 'SOFTWARE',
    };
    const productResponse = await this.transport.createProduct(productPayload);
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
          total_cycles: 0,
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

    const planResponse = await this.transport.createPlan(planPayload);
    const planErrorMessage = readStringPath(planResponse, ['error', 'message']);
    if (planErrorMessage) {
      throw new UpstreamError(502, planErrorMessage);
    }
    const planId = readStringPath(planResponse, ['id']);
    if (!planId) {
      throw new UpstreamError(502, 'PayPal plan creation failed: missing id');
    }

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

    const subscriptionResponse =
      await this.transport.createSubscription(subscriptionPayload);
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
  }): Promise<PaymentSession> {
    if (!sessionId) {
      throw new BadRequestError('sessionId is required');
    }

    let result = await this.transport.getOrder(sessionId);
    if (readStringPath(result, ['name']) === 'RESOURCE_NOT_FOUND') {
      result = await this.transport.getSubscription(sessionId);
    }

    const errorMessage = readStringPath(result, ['error', 'message']);
    if (errorMessage) {
      throw new UpstreamError(502, errorMessage);
    }

    const paymentSession = buildPayPalPaymentSession({
      provider: this.name,
      result,
    });
    this.assertSuccessfulPaymentSession(paymentSession);
    return paymentSession;
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const webhookEvent = this.transport.parseWebhookEvent(rawBody);
    await this.transport.verifyWebhookSignature({
      headers: Object.fromEntries(req.headers.entries()),
      webhookEvent,
    });

    const mappedEventType = this.mapPayPalEventType(webhookEvent.event_type);
    const resourceId = readStringPath(webhookEvent.resource, ['id']);
    const resource = webhookEvent.resource;
    let paymentSession: PaymentSession | undefined;

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
    } else if (mappedEventType === PaymentEventType.PAYMENT_SUCCESS) {
      if (!resource) {
        throw new WebhookPayloadError('missing paypal payment resource');
      }
      paymentSession = buildPayPalWebhookPaymentSession({
        provider: this.name,
        resource,
      });
      const subscriptionId = extractPayPalWebhookSubscriptionId(resource);
      if (subscriptionId) {
        const {
          subscription,
          subscriptionId: validatedSubscriptionId,
        } = await this.getValidatedSubscription(subscriptionId);
        paymentSession = mergePayPalRenewalSubscription({
          session: paymentSession,
          subscription,
          subscriptionId: validatedSubscriptionId,
        });
      }
    } else if (mappedEventType === PaymentEventType.UNKNOWN) {
      paymentSession = {
        provider: this.name,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: resource ?? webhookEvent,
        metadata: {
          event_type: webhookEvent.event_type,
          event_id: webhookEvent.id,
        },
      };
    } else {
      paymentSession = {
        provider: this.name,
        paymentStatus: PaymentStatus.PROCESSING,
        paymentResult: resource ?? webhookEvent,
      };
    }

    this.assertSuccessfulPaymentSession(paymentSession);
    return {
      eventType: mappedEventType,
      eventResult: webhookEvent,
      paymentSession,
    };
  }

  private async getSubscriptionSession({
    subscriptionId,
    eventType,
  }: {
    subscriptionId: string;
    eventType: PayPalSubscriptionEventType;
  }): Promise<PaymentSession> {
    const {
      subscription,
      subscriptionId: validatedSubscriptionId,
    } = await this.getValidatedSubscription(subscriptionId);
    return buildPayPalSubscriptionSession({
      provider: this.name,
      subscription,
      subscriptionId: validatedSubscriptionId,
      eventType,
    });
  }

  private async getValidatedSubscription(
    subscriptionId: string
  ): Promise<{ subscription: unknown; subscriptionId: string }> {
    const subscription = await this.transport.getSubscription(subscriptionId);

    const errorMessage = readStringPath(subscription, ['error', 'message']);
    if (errorMessage) {
      throw new UpstreamError(502, errorMessage);
    }

    const resolvedSubscriptionId =
      readStringPath(subscription, ['id']) ?? subscriptionId;

    if (!this.isValidSubscriptionResponse(subscription, resolvedSubscriptionId)) {
      throw new UpstreamError(502, 'invalid paypal subscription response');
    }

    return {
      subscription,
      subscriptionId: resolvedSubscriptionId,
    };
  }

  private isValidSubscriptionResponse(
    subscription: unknown,
    fallbackSubscriptionId: string
  ): boolean {
    const resolvedSubscriptionId =
      readStringPath(subscription, ['id']) ?? fallbackSubscriptionId;
    if (!resolvedSubscriptionId) {
      return false;
    }

    const status = readStringPath(subscription, ['status']);
    if (!status || !this.isRecognizedSubscriptionStatus(status)) {
      return false;
    }

    const currentPeriodStart =
      this.readDateTimePath(subscription, ['billing_info', 'last_payment', 'time']) ??
      this.readDateTimePath(subscription, ['start_time']);
    if (!currentPeriodStart) {
      return false;
    }

    const currentPeriodEnd =
      this.readDateTimePath(subscription, ['billing_info', 'next_billing_time']) ??
      this.readDateTimePath(subscription, ['billing_info', 'final_payment_time']);

    return Boolean(currentPeriodEnd);
  }

  private isRecognizedSubscriptionStatus(status: string): boolean {
    switch (status) {
      case 'ACTIVE':
      case 'SUSPENDED':
      case 'CANCELLED':
      case 'EXPIRED':
      case 'APPROVAL_PENDING':
      case 'APPROVED':
        return true;
      default:
        return false;
    }
  }

  private readDateTimePath(
    root: unknown,
    path: string[]
  ): string | undefined {
    const value = readStringPath(root, path);
    if (!value) {
      return undefined;
    }

    return Number.isNaN(new Date(value).getTime()) ? undefined : value;
  }

  private mapPayPalEventType(eventType: string): PaymentEventType {
    return mapPayPalEventTypeToCanonical(eventType);
  }

  private assertSuccessfulPaymentSession(session: PaymentSession): void {
    assertSuccessfulPaymentSessionContract(session);
  }
}
