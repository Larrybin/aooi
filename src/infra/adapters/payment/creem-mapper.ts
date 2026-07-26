import {
  PaymentInterval,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionStatus,
  WebhookPayloadError,
  type PaymentSession,
  type SubscriptionInfo,
} from '@/domains/billing/domain/payment';
import { z } from 'zod';

import { UpstreamError } from '@/shared/lib/api/errors';

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

type CreemSubscription = z.infer<typeof creemSubscriptionSchema>;
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

function mapCreemStatus(session: unknown): PaymentStatus {
  const checkedSession = parseOrThrow(
    creemInvoiceSchema,
    session,
    new WebhookPayloadError('invalid creem session payload')
  );
  const orderCandidate =
    checkedSession.order ?? checkedSession.last_transaction;
  const order = creemOrderLikeSchema.safeParse(orderCandidate);
  const orderStatus = order.success ? order.data.status : undefined;

  if (orderStatus === 'paid') {
    return PaymentStatus.SUCCESS;
  }

  throw new WebhookPayloadError(
    `Unknown Creem session status: ${checkedSession.status}`
  );
}

function mapCreemInterval(product: { billing_period?: string } | undefined): {
  interval: PaymentInterval;
  count: number;
} {
  if (!product || !product.billing_period) {
    throw new UpstreamError(502, 'Invalid product');
  }

  switch (product.billing_period) {
    case 'every-month':
      return { interval: PaymentInterval.MONTH, count: 1 };
    case 'every-three-months':
      return { interval: PaymentInterval.MONTH, count: 3 };
    case 'every-six-months':
      return { interval: PaymentInterval.MONTH, count: 6 };
    case 'every-year':
      return { interval: PaymentInterval.YEAR, count: 1 };
    case 'once':
      return { interval: PaymentInterval.ONE_TIME, count: 1 };
    default:
      throw new UpstreamError(
        502,
        `Unknown Creem product billing period: ${product.billing_period}`
      );
  }
}

async function buildCreemSubscriptionInfo(
  subscription: CreemSubscription,
  product?: unknown
): Promise<SubscriptionInfo> {
  const parsedProduct = creemProductSchema.safeParse(product);
  const checkedProduct = parsedProduct.success ? parsedProduct.data : undefined;
  const { interval, count } = mapCreemInterval(checkedProduct);

  const subscriptionInfo: SubscriptionInfo = {
    subscriptionId: subscription.id,
    productId: checkedProduct?.id,
    planId: '',
    description: checkedProduct?.description,
    amount: checkedProduct?.price,
    currency: checkedProduct?.currency,
    currentPeriodStart: new Date(subscription.current_period_start_date),
    currentPeriodEnd: new Date(subscription.current_period_end_date),
    interval,
    intervalCount: count,
    metadata: subscription.metadata,
  };

  if (subscription.status === 'active') {
    subscriptionInfo.status = subscription.cancel_at
      ? SubscriptionStatus.PENDING_CANCEL
      : SubscriptionStatus.ACTIVE;
  } else if (subscription.status === 'canceled') {
    subscriptionInfo.status = SubscriptionStatus.CANCELED;
  } else if (subscription.status === 'trialing') {
    subscriptionInfo.status = SubscriptionStatus.TRIALING;
  } else if (subscription.status === 'paused') {
    subscriptionInfo.status = SubscriptionStatus.PAUSED;
  } else {
    throw new UpstreamError(
      502,
      `Unknown Creem subscription status: ${subscription.status}`
    );
  }

  if (subscription.canceled_at !== undefined) {
    subscriptionInfo.canceledAt = new Date(subscription.canceled_at);
  }

  return subscriptionInfo;
}

export async function buildCreemPaymentSessionFromCheckoutSession({
  provider,
  session,
}: {
  provider: string;
  session: unknown;
}): Promise<PaymentSession> {
  const checkedSession = parseOrThrow(
    creemInvoiceSchema,
    session,
    new WebhookPayloadError('invalid creem checkout session payload')
  );
  const orderCandidate =
    checkedSession.order ?? checkedSession.last_transaction;
  const order = creemOrderLikeSchema.safeParse(orderCandidate);
  const checkedOrder = order.success ? order.data : undefined;
  const subscriptionCandidate = checkedSession.subscription;
  const subscription = subscriptionCandidate
    ? parseOrThrow(
        creemSubscriptionSchema,
        subscriptionCandidate,
        new WebhookPayloadError('invalid creem subscription payload')
      )
    : undefined;

  const result: PaymentSession = {
    provider,
    paymentStatus: mapCreemStatus(checkedSession),
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
      paymentEmail: checkedSession.customer?.email,
      paymentUserName: checkedSession.customer?.name,
      paymentUserId: checkedSession.customer?.id,
      paidAt: checkedOrder?.created_at
        ? new Date(checkedOrder.created_at)
        : undefined,
      invoiceId: '',
      invoiceUrl: '',
    },
    paymentResult: checkedSession,
    metadata: checkedSession.metadata,
  };

  if (!subscription) {
    return result;
  }

  result.subscriptionId = subscription.id;
  result.subscriptionInfo = await buildCreemSubscriptionInfo(
    subscription,
    subscription.product
  );
  result.subscriptionResult = subscription;
  return result;
}

export async function buildCreemPaymentSessionFromSubscription({
  provider,
  subscription,
}: {
  provider: string;
  subscription: unknown;
}): Promise<PaymentSession> {
  const checkedSubscription = parseOrThrow(
    creemSubscriptionSchema,
    subscription,
    new WebhookPayloadError('invalid creem subscription payload')
  );

  return {
    provider,
    subscriptionId: checkedSubscription.id,
    subscriptionInfo: await buildCreemSubscriptionInfo(
      checkedSubscription,
      checkedSubscription.product
    ),
    subscriptionResult: checkedSubscription,
  };
}

export function buildCreemUnknownPaymentSession({
  provider,
  eventType,
  eventId,
  eventResult,
}: {
  provider: string;
  eventType: string;
  eventId?: string;
  eventResult: unknown;
}): PaymentSession {
  return {
    provider,
    paymentStatus: PaymentStatus.PROCESSING,
    paymentResult: eventResult,
    metadata: {
      event_type: eventType,
      ...(eventId ? { event_id: eventId } : {}),
    },
  };
}

const creemRefundSchema = z
  .object({
    id: z.string().optional(),
    transaction: z.string().optional(),
    amount: z.number().optional(),
    refund_amount: z.number().optional(),
    currency: z.string().optional(),
    order: z.unknown().optional(),
    checkout: z.unknown().optional(),
    subscription: z.unknown().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

function readNestedMetadata(value: unknown): Record<string, unknown> | undefined {
  const parsed = creemRefundSchema.safeParse(value);
  return parsed.success ? parsed.data.metadata : undefined;
}

/**
 * Build a session for `refund.created`.
 *
 * Creem does not publish this payload's shape anywhere in this repository, so
 * every field is optional and nothing here throws. The refund handler only needs
 * enough to identify the original order - `metadata.order_no`, otherwise the
 * transaction id - and is written to fall back to audit-and-alert when it finds
 * neither. Guessing wrong would revoke a different customer's entitlements, so
 * an absent field is left absent rather than inferred.
 */
export function buildCreemPaymentSessionFromRefund({
  provider,
  refund,
}: {
  provider: string;
  refund: unknown;
}): PaymentSession {
  const parsed = creemRefundSchema.safeParse(refund);
  const checkedRefund = parsed.success ? parsed.data : undefined;

  const metadata =
    checkedRefund?.metadata ??
    readNestedMetadata(checkedRefund?.order) ??
    readNestedMetadata(checkedRefund?.checkout) ??
    readNestedMetadata(checkedRefund?.subscription);

  const order = creemOrderLikeSchema.safeParse(checkedRefund?.order);
  const transactionId =
    (order.success ? order.data.transaction || order.data.id : undefined) ||
    checkedRefund?.transaction;

  return {
    provider,
    paymentStatus: PaymentStatus.PROCESSING,
    paymentResult: refund,
    ...(transactionId
      ? {
          paymentInfo: {
            transactionId,
            // On a refund event these describe the amount going back to the
            // buyer, not the original payment. Nothing downstream reconciles a
            // refund against the order total, and leaving them unset is not an
            // option because PaymentInfo requires both.
            paymentAmount:
              checkedRefund?.refund_amount ?? checkedRefund?.amount ?? 0,
            paymentCurrency: checkedRefund?.currency ?? '',
          },
        }
      : {}),
    ...(metadata ? { metadata } : {}),
  };
}

export async function buildCreemPaymentSessionFromInvoice({
  provider,
  invoice,
}: {
  provider: string;
  invoice: unknown;
}): Promise<PaymentSession> {
  const checkedInvoice = parseOrThrow(
    creemInvoiceSchema,
    invoice,
    new WebhookPayloadError('invalid creem invoice payload')
  );
  const orderCandidate =
    checkedInvoice.order ?? checkedInvoice.last_transaction;
  const order = creemOrderLikeSchema.safeParse(orderCandidate);
  const checkedOrder = order.success ? order.data : undefined;
  const subscription = parseOrThrow(
    creemSubscriptionSchema,
    checkedInvoice.subscription ?? checkedInvoice,
    new WebhookPayloadError('invalid creem subscription payload')
  );

  const subscriptionCreatedAt = subscription.created_at
    ? new Date(subscription.created_at)
    : new Date(0);
  const currentPeriodStartAt = new Date(subscription.current_period_start_date);
  const cycleType =
    currentPeriodStartAt.getTime() - subscriptionCreatedAt.getTime() < 5000
      ? SubscriptionCycleType.CREATE
      : SubscriptionCycleType.RENEWAL;

  return {
    provider,
    paymentStatus: mapCreemStatus(checkedInvoice),
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
      invoiceId: '',
      invoiceUrl: '',
      subscriptionCycleType: cycleType,
    },
    paymentResult: checkedInvoice,
    metadata: checkedInvoice.metadata,
    subscriptionId: subscription.id,
    subscriptionInfo: await buildCreemSubscriptionInfo(
      subscription,
      subscription.product
    ),
    subscriptionResult: subscription,
  };
}
