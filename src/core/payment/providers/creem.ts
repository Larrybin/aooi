import {
  PaymentEventType,
  WebhookPayloadError,
  type CheckoutSession,
  type PaymentBilling,
  type PaymentCustomField,
  type PaymentEvent,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentSession,
} from '@/core/payment/domain';
import {
  buildCreemPaymentSessionFromCheckoutSession,
  buildCreemPaymentSessionFromInvoice,
  buildCreemPaymentSessionFromSubscription,
  buildCreemUnknownPaymentSession,
} from '@/core/payment/providers/creem-mapper';
import {
  CreemTransport,
  type CreemConfigs,
} from '@/core/payment/providers/creem-transport';
import {
  assertSuccessfulPaymentSessionContract,
  mapCreemEventTypeToCanonical,
} from '@/core/payment/providers/provider-contract';
import { BadRequestError, UpstreamError } from '@/shared/lib/api/errors';
import {
  toJsonValue,
  type JsonObject,
  type JsonValue,
} from '@/shared/lib/json';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string' && error) return error;
  if (isRecord(error) && typeof error.message === 'string' && error.message) {
    return error.message;
  }
  return undefined;
};

const readRecordStringValue = (
  value: unknown,
  key: string
): string | undefined => {
  if (!isRecord(value)) return undefined;
  const raw = value[key];
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim();
  return normalized || undefined;
};

export class CreemProvider implements PaymentProvider {
  readonly name = 'creem';
  configs: CreemConfigs;

  private readonly transport: CreemTransport;

  constructor(
    configs: CreemConfigs,
    options?: { transport?: CreemTransport }
  ) {
    this.configs = configs;
    this.transport = options?.transport ?? new CreemTransport(configs);
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    if (!order.productId) {
      throw new BadRequestError('productId is required');
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

    const result = await this.transport.createCheckout(payload);
    const checkoutParams = JSON.parse(JSON.stringify(payload)) as JsonValue;
    const checkoutMetadata = JSON.parse(
      JSON.stringify(order.metadata || {})
    ) as JsonObject;

    const errorMessage = getErrorMessage(result.error);
    if (errorMessage) {
      throw new UpstreamError(502, errorMessage);
    }

    if (!result.id || !result.checkout_url) {
      throw new UpstreamError(502, 'create payment failed');
    }

    return {
      provider: this.name,
      checkoutParams,
      checkoutInfo: {
        sessionId: result.id,
        checkoutUrl: result.checkout_url,
      },
      checkoutResult: result as JsonValue,
      metadata: checkoutMetadata,
    };
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    const session = await this.transport.getCheckoutSession(sessionId);
    if (!session.id || !session.order) {
      const errorMessage = getErrorMessage(session.error);
      throw new UpstreamError(502, errorMessage || 'get payment failed');
    }

    const paymentSession = await buildCreemPaymentSessionFromCheckoutSession({
      provider: this.name,
      session,
    });
    this.assertSuccessfulPaymentSession(paymentSession);
    return paymentSession;
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const rawBody = await req.text();
    const webhookEvent = await this.transport.verifyWebhookEvent({
      rawBody,
      signatureHeader: req.headers.get('creem-signature'),
    });
    const webhookEventResult = toJsonValue(webhookEvent);
    const webhookEventId =
      readRecordStringValue(webhookEvent, 'id') ||
      readRecordStringValue(webhookEvent.object, 'id');
    const eventType = this.mapCreemEventType(webhookEvent.eventType);

    let paymentSession: PaymentSession | undefined;
    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      paymentSession = await buildCreemPaymentSessionFromCheckoutSession({
        provider: this.name,
        session: webhookEvent.object,
      });
    } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
      paymentSession = await buildCreemPaymentSessionFromInvoice({
        provider: this.name,
        invoice: webhookEvent.object,
      });
    } else if (
      eventType === PaymentEventType.SUBSCRIBE_UPDATED ||
      eventType === PaymentEventType.SUBSCRIBE_CANCELED
    ) {
      paymentSession = await buildCreemPaymentSessionFromSubscription({
        provider: this.name,
        subscription: webhookEvent.object,
      });
    } else if (eventType === PaymentEventType.UNKNOWN) {
      paymentSession = buildCreemUnknownPaymentSession({
        provider: this.name,
        eventType: webhookEvent.eventType,
        eventId: webhookEventId,
        eventResult: webhookEventResult,
      });
    }

    if (!paymentSession) {
      throw new WebhookPayloadError('invalid webhook event');
    }

    this.assertSuccessfulPaymentSession(paymentSession);
    return {
      eventType,
      eventResult: webhookEventResult,
      paymentSession,
    };
  }

  async getPaymentBilling({
    customerId,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling> {
    const billing = await this.transport.getCustomerBilling(customerId);
    if (!billing.customer_portal_link) {
      throw new UpstreamError(502, 'get billing url failed');
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
    const subscription = await this.transport.cancelSubscription(subscriptionId);
    if (!subscription.canceled_at) {
      throw new UpstreamError(502, 'cancel subscription failed');
    }

    return await buildCreemPaymentSessionFromSubscription({
      provider: this.name,
      subscription,
    });
  }

  private assertSuccessfulPaymentSession(session: PaymentSession): void {
    assertSuccessfulPaymentSessionContract(session);
  }

  private mapCreemEventType(eventType: string): PaymentEventType {
    return mapCreemEventTypeToCanonical(eventType);
  }
}
