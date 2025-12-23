import 'server-only';

import { z } from 'zod';

import { UpstreamError } from '@/shared/lib/api/errors';
import { toJsonObject, toJsonValue } from '@/shared/lib/json';

import {
  PaymentEventType,
  PaymentInterval,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionStatus,
  WebhookPayloadError,
  type CheckoutSession,
  type PaymentBilling,
  type PaymentEvent,
  type PaymentInvoice,
  type PaymentOrder,
  type PaymentProvider,
  type PaymentProviderDriver,
  type PaymentSession,
  type RawCheckoutSession,
  type RawPaymentSession,
} from '.';

const checkoutInfoSchema = z.object({
  sessionId: z.string().min(1),
  checkoutUrl: z.string().min(1),
});

const rawCheckoutSessionSchema = z.object({
  provider: z.string().min(1),
  checkoutParams: z.unknown(),
  checkoutInfo: checkoutInfoSchema,
  checkoutResult: z.unknown(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const paymentInfoSchema = z
  .object({
    description: z.string().optional(),
    transactionId: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    discountCode: z.string().optional(),
    discountAmount: z.number().optional(),
    discountCurrency: z.string().optional(),
    paymentAmount: z.number(),
    paymentCurrency: z.string(),
    paymentEmail: z.string().optional(),
    paymentUserName: z.string().optional(),
    paymentUserId: z.string().optional(),
    paidAt: z.date().optional(),
    invoiceId: z.string().optional(),
    invoiceUrl: z.string().optional(),
    subscriptionCycleType: z.nativeEnum(SubscriptionCycleType).optional(),
  })
  .passthrough();

const subscriptionInfoSchema = z
  .object({
    subscriptionId: z.string().min(1),
    planId: z.string().optional(),
    productId: z.string().optional(),
    description: z.string().optional(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    interval: z.nativeEnum(PaymentInterval).optional(),
    intervalCount: z.number().optional(),
    trialPeriodDays: z.number().optional(),
    currentPeriodStart: z.date(),
    currentPeriodEnd: z.date(),
    billingUrl: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    status: z.nativeEnum(SubscriptionStatus).optional(),
    canceledAt: z.date().optional(),
    canceledReason: z.string().optional(),
    canceledReasonType: z.string().optional(),
    canceledEndAt: z.date().optional(),
  })
  .passthrough();

const rawPaymentSessionSchema = z.object({
  provider: z.string().min(1),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  paymentInfo: paymentInfoSchema.optional(),
  paymentResult: z.unknown().optional(),
  subscriptionId: z.string().optional(),
  subscriptionInfo: subscriptionInfoSchema.optional(),
  subscriptionResult: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const rawPaymentEventSchema = z.object({
  eventType: z.nativeEnum(PaymentEventType),
  eventResult: z.unknown(),
  paymentSession: rawPaymentSessionSchema,
});

function toCheckoutSession(raw: RawCheckoutSession): CheckoutSession {
  return {
    provider: raw.provider,
    checkoutParams: toJsonValue(raw.checkoutParams),
    checkoutInfo: raw.checkoutInfo,
    checkoutResult: toJsonValue(raw.checkoutResult),
    metadata: toJsonObject(raw.metadata),
  };
}

function toPaymentSession(raw: RawPaymentSession): PaymentSession {
  return {
    provider: raw.provider,
    paymentStatus: raw.paymentStatus,
    paymentInfo: raw.paymentInfo,
    paymentResult:
      raw.paymentResult === undefined
        ? undefined
        : toJsonValue(raw.paymentResult),
    subscriptionId: raw.subscriptionId,
    subscriptionInfo: raw.subscriptionInfo,
    subscriptionResult:
      raw.subscriptionResult === undefined
        ? undefined
        : toJsonValue(raw.subscriptionResult),
    metadata: raw.metadata ? toJsonObject(raw.metadata) : undefined,
  };
}

function parseOrThrow<Schema extends z.ZodTypeAny>(
  schema: Schema,
  value: unknown,
  error: Error
): z.infer<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw error;
  }
  return parsed.data;
}

export class PaymentProviderAdapter implements PaymentProvider {
  readonly name: string;
  configs: PaymentProviderDriver['configs'];
  readonly getPaymentInvoice?:
    | ((args: { invoiceId: string }) => Promise<PaymentInvoice>)
    | undefined;
  readonly getPaymentBilling?:
    | ((args: {
        customerId: string;
        returnUrl?: string;
      }) => Promise<PaymentBilling>)
    | undefined;
  readonly cancelSubscription?:
    | ((args: { subscriptionId: string }) => Promise<PaymentSession>)
    | undefined;

  constructor(private readonly driver: PaymentProviderDriver) {
    this.name = driver.name;
    this.configs = driver.configs;

    if (driver.getPaymentInvoice) {
      this.getPaymentInvoice = async ({ invoiceId }) =>
        driver.getPaymentInvoice?.({ invoiceId }) as Promise<PaymentInvoice>;
    }

    if (driver.getPaymentBilling) {
      this.getPaymentBilling = async ({ customerId, returnUrl }) =>
        driver.getPaymentBilling?.({
          customerId,
          returnUrl,
        }) as Promise<PaymentBilling>;
    }

    if (driver.cancelSubscription) {
      this.cancelSubscription = async ({ subscriptionId }) => {
        const raw = await driver.cancelSubscription?.({ subscriptionId });
        const checked = parseOrThrow(
          rawPaymentSessionSchema,
          raw,
          new UpstreamError(502, 'invalid payment provider cancel response')
        );
        return toPaymentSession(checked);
      };
    }
  }

  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    const raw = await this.driver.createPayment({ order });
    const checked = parseOrThrow(
      rawCheckoutSessionSchema,
      raw,
      new UpstreamError(502, 'invalid payment provider checkout response')
    );
    return toCheckoutSession(checked);
  }

  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    const raw = await this.driver.getPaymentSession({ sessionId });
    const checked = parseOrThrow(
      rawPaymentSessionSchema,
      raw,
      new UpstreamError(502, 'invalid payment provider session response')
    );
    return toPaymentSession(checked);
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    const raw = await this.driver.getPaymentEvent({ req });
    const checked = parseOrThrow(
      rawPaymentEventSchema,
      raw,
      new WebhookPayloadError('invalid payment provider webhook payload')
    );

    return {
      eventType: checked.eventType,
      eventResult: toJsonValue(checked.eventResult),
      paymentSession: toPaymentSession(checked.paymentSession),
    };
  }
}

export function withPaymentProviderAdapter(
  driver: PaymentProviderDriver
): PaymentProvider {
  return new PaymentProviderAdapter(driver);
}
