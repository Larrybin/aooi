import { createHash } from 'crypto';

import {
  PaymentEventType,
  SubscriptionCycleType,
  type PaymentEvent,
  type PaymentSession,
} from '@/extensions/payment';
import { BadRequestError, NotFoundError } from '@/shared/lib/api/errors';
import { toJsonValue } from '@/shared/lib/json';
import { jsonOk } from '@/shared/lib/api/response';
import type { Order } from '@/shared/models/order';
import type { Subscription } from '@/shared/models/subscription';

/**
 * Payment notify processing pipeline
 *
 * [Webhook/API]
 *    -> [Provider Parse+Map]
 *    -> [Canonical PaymentEvent]
 *    -> [processPaymentNotifyEvent]
 *    -> [Payment Flow State Machine]
 *    -> [Order/Subscription Tx + Credit Grant]
 */
type PaymentNotifyLog = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

type FindOrderByInvoiceId = (args: {
  provider: string;
  invoiceId: string;
}) => Promise<Order | null>;

type FindOrderByOrderNo = (orderNo: string) => Promise<Order | null>;

type FindOrderByTransactionId = (args: {
  provider: string;
  transactionId: string;
}) => Promise<Order | null>;

type FindSubscriptionByProviderSubscriptionId = (args: {
  provider: string;
  subscriptionId: string;
}) => Promise<Subscription | null>;

type HandleCheckoutSuccess = (args: {
  order: Order;
  session: PaymentSession;
  log: PaymentNotifyLog;
}) => Promise<void>;

type HandleSubscriptionCanceled = (args: {
  subscription: Subscription;
  session: PaymentSession;
  log: PaymentNotifyLog;
}) => Promise<void>;

type HandleSubscriptionRenewal = (args: {
  subscription: Subscription;
  session: PaymentSession;
  log: PaymentNotifyLog;
}) => Promise<void>;

type HandleSubscriptionUpdated = (args: {
  subscription: Subscription;
  session: PaymentSession;
  log: PaymentNotifyLog;
}) => Promise<void>;

type RecordUnknownWebhookEvent = (args: {
  provider: string;
  eventType: string;
  eventId?: string | null;
  rawDigest: string;
  receivedAt: Date;
}) => Promise<void>;

export type PaymentNotifyDeps = {
  findOrderByInvoiceId: FindOrderByInvoiceId;
  findOrderByOrderNo: FindOrderByOrderNo;
  findOrderByTransactionId: FindOrderByTransactionId;
  findSubscriptionByProviderSubscriptionId: FindSubscriptionByProviderSubscriptionId;
  recordUnknownWebhookEvent: RecordUnknownWebhookEvent;
  handleCheckoutSuccess: HandleCheckoutSuccess;
  handleSubscriptionCanceled: HandleSubscriptionCanceled;
  handleSubscriptionRenewal: HandleSubscriptionRenewal;
  handleSubscriptionUpdated: HandleSubscriptionUpdated;
};

export type PaymentNotifyProcessOutcome =
  | 'processed'
  | 'ignored_unknown'
  | 'already_processed'
  | 'ignored';

export type PaymentNotifyProcessResult = {
  response: Response;
  outcome: PaymentNotifyProcessOutcome;
  eventType: PaymentEventType;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function readNormalizedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function readUnknownEventId({
  event,
  session,
}: {
  event: PaymentEvent;
  session: PaymentSession;
}): string | null {
  const metadataEventId =
    readNormalizedString(session.metadata?.event_id) ||
    readNormalizedString(session.metadata?.eventId) ||
    readNormalizedString(session.metadata?.id);
  if (metadataEventId) {
    return metadataEventId;
  }

  if (!isRecord(event.eventResult)) {
    return null;
  }

  return (
    readNormalizedString(event.eventResult.id) ||
    readNormalizedString(event.eventResult.event_id) ||
    readNormalizedString(event.eventResult.eventId) ||
    null
  );
}

function resolveUnknownEventType({
  event,
  session,
}: {
  event: PaymentEvent;
  session: PaymentSession;
}): string {
  const metadataEventType =
    readNormalizedString(session.metadata?.event_type) ||
    readNormalizedString(session.metadata?.eventType);
  return metadataEventType || event.eventType;
}

function buildEventResultRawDigest(eventResult: unknown): string {
  const canonicalResult = toJsonValue(eventResult);
  const canonicalPayload = JSON.stringify(canonicalResult);
  return createHash('sha256').update(canonicalPayload).digest('hex');
}

function toISOStringOrNull(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

export function buildSubscriptionRenewalDedupeKey(input: {
  provider: string;
  subscriptionId: string;
  subscriptionInfo: { currentPeriodStart: unknown; currentPeriodEnd: unknown };
}): string | null {
  const start = toISOStringOrNull(input.subscriptionInfo.currentPeriodStart);
  const end = toISOStringOrNull(input.subscriptionInfo.currentPeriodEnd);
  if (!start || !end) return null;
  return `renewal:${input.provider}:${input.subscriptionId}:${start}:${end}`;
}

function requireOrderNoFromSession(session: PaymentSession): string {
  const orderNoValue = session.metadata?.order_no;
  const orderNo = typeof orderNoValue === 'string' ? orderNoValue.trim() : '';
  if (!orderNo) {
    throw new BadRequestError('order no not found');
  }
  return orderNo;
}

function hasSubscriptionContext(
  session: PaymentSession
): session is PaymentSession & {
  subscriptionId: string;
  subscriptionInfo: NonNullable<PaymentSession['subscriptionInfo']>;
} {
  return Boolean(session.subscriptionId && session.subscriptionInfo);
}

function requireSubscriptionContext(
  session: PaymentSession
): asserts session is PaymentSession & {
  subscriptionId: string;
  subscriptionInfo: NonNullable<PaymentSession['subscriptionInfo']>;
} {
  if (!hasSubscriptionContext(session)) {
    throw new BadRequestError('subscription id or subscription info not found');
  }
}

async function requireExistingSubscription({
  provider,
  subscriptionId,
  deps,
}: {
  provider: string;
  subscriptionId: string;
  deps: Pick<PaymentNotifyDeps, 'findSubscriptionByProviderSubscriptionId'>;
}) {
  const existingSubscription = await deps.findSubscriptionByProviderSubscriptionId({
    provider,
    subscriptionId,
  });
  if (!existingSubscription) {
    throw new NotFoundError('subscription not found');
  }
  return existingSubscription;
}

export async function processPaymentNotifyEvent({
  provider,
  event,
  log,
  deps,
}: {
  provider: string;
  event: PaymentEvent;
  log: PaymentNotifyLog;
  deps: PaymentNotifyDeps;
}): Promise<PaymentNotifyProcessResult> {
  if (!event.eventType) throw new BadRequestError('event type not found');
  if (!event.paymentSession) {
    throw new BadRequestError('payment session not found');
  }

  const eventType = event.eventType;
  const session = event.paymentSession;

  switch (eventType) {
    case PaymentEventType.UNKNOWN: {
      const eventId = readUnknownEventId({ event, session });
      const unknownEventType = resolveUnknownEventType({ event, session });
      const rawDigest = buildEventResultRawDigest(event.eventResult);
      const receivedAt = new Date();

      try {
        await deps.recordUnknownWebhookEvent({
          provider,
          eventType: unknownEventType,
          eventId,
          rawDigest,
          receivedAt,
        });
      } catch (error: unknown) {
        log.error('payment: notify failed to audit unknown event', {
          provider,
          eventType,
          unknownEventType,
          eventId,
          rawDigest,
          error,
        });
        throw error;
      }

      log.warn('payment: notify ignored unknown event', {
        provider,
        eventType,
        sessionProvider: session.provider,
        sessionStatus: session.paymentStatus,
        unknownEventType,
        eventId,
        rawDigest,
        receivedAt: receivedAt.toISOString(),
        metadata: session.metadata,
        eventResult: event.eventResult,
      });
      return {
        response: jsonOk({ message: 'ignored' }),
        outcome: 'ignored_unknown',
        eventType,
      };
    }

    case PaymentEventType.CHECKOUT_SUCCESS: {
      const orderNo = requireOrderNoFromSession(session);

      const order = await deps.findOrderByOrderNo(orderNo);
      if (!order) {
        throw new NotFoundError('order not found');
      }

      if (
        order.status === 'paid' ||
        order.status === 'failed' ||
        order.status === 'completed'
      ) {
        return {
          response: jsonOk({ message: 'already processed' }),
          outcome: 'already_processed',
          eventType,
        };
      }

      await deps.handleCheckoutSuccess({ order, session, log });
      break;
    }

    case PaymentEventType.PAYMENT_SUCCESS: {
      if (!hasSubscriptionContext(session)) {
        log.debug('payment: notify ignored one-time payment', {
          provider,
          eventType,
        });
        break;
      }

      if (
        session.paymentInfo?.subscriptionCycleType !==
        SubscriptionCycleType.RENEWAL
      ) {
        log.debug('payment: notify ignored subscription first payment', {
          provider,
          eventType,
        });
        break;
      }

      const rawTransactionId = session.paymentInfo?.transactionId?.trim();
      const rawInvoiceId = session.paymentInfo?.invoiceId?.trim();

      if (rawTransactionId) {
        const existingOrder = await deps.findOrderByTransactionId({
          provider,
          transactionId: rawTransactionId,
        });
        if (existingOrder) {
          log.debug('payment: notify ignored duplicate renewal', {
            provider,
            eventType,
            transactionId: rawTransactionId,
          });
          return {
            response: jsonOk({ message: 'already processed' }),
            outcome: 'already_processed',
            eventType,
          };
        }
      }

      if (rawInvoiceId && rawInvoiceId !== rawTransactionId) {
        const existingOrder = await deps.findOrderByInvoiceId({
          provider,
          invoiceId: rawInvoiceId,
        });
        if (existingOrder) {
          log.debug('payment: notify ignored duplicate renewal', {
            provider,
            eventType,
            invoiceId: rawInvoiceId,
          });
          return {
            response: jsonOk({ message: 'already processed' }),
            outcome: 'already_processed',
            eventType,
          };
        }
      }

      const dedupeTransactionId =
        rawTransactionId ||
        rawInvoiceId ||
        buildSubscriptionRenewalDedupeKey({
          provider,
          subscriptionId: session.subscriptionId,
          subscriptionInfo: session.subscriptionInfo,
        });

      if (!dedupeTransactionId) {
        log.error('payment: renewal missing idempotency context, ignored', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
        });
        return {
          response: jsonOk({ message: 'ignored' }),
          outcome: 'ignored',
          eventType,
        };
      }

      if (!rawTransactionId && !rawInvoiceId) {
        const existingOrder = await deps.findOrderByTransactionId({
          provider,
          transactionId: dedupeTransactionId,
        });
        if (existingOrder) {
          log.debug('payment: notify ignored duplicate renewal', {
            provider,
            eventType,
            transactionId: dedupeTransactionId,
          });
          return {
            response: jsonOk({ message: 'already processed' }),
            outcome: 'already_processed',
            eventType,
          };
        }

        log.warn('payment: renewal idempotency keys missing, using fallback', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
        });
      }

      const existingSubscription = await requireExistingSubscription({
        provider,
        subscriptionId: session.subscriptionId,
        deps,
      });

      const paymentInfo = session.paymentInfo;
      if (!paymentInfo) {
        log.error('payment: renewal missing payment info, ignored', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
        });
        return {
          response: jsonOk({ message: 'ignored' }),
          outcome: 'ignored',
          eventType,
        };
      }

      const sessionForRenewal: PaymentSession = {
        ...session,
        paymentInfo: {
          ...paymentInfo,
          transactionId: dedupeTransactionId,
          invoiceId: rawInvoiceId || paymentInfo.invoiceId,
        },
      };

      await deps.handleSubscriptionRenewal({
        subscription: existingSubscription,
        session: sessionForRenewal,
        log,
      });
      break;
    }

    case PaymentEventType.SUBSCRIBE_UPDATED: {
      requireSubscriptionContext(session);
      const existingSubscription = await requireExistingSubscription({
        provider,
        subscriptionId: session.subscriptionId,
        deps,
      });

      if (existingSubscription.status === 'canceled') {
        log.debug('payment: notify ignored canceled subscription', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
          subscriptionNo: existingSubscription.subscriptionNo,
        });
        return {
          response: jsonOk({ message: 'already processed' }),
          outcome: 'already_processed',
          eventType,
        };
      }

      await deps.handleSubscriptionUpdated({
        subscription: existingSubscription,
        session,
        log,
      });
      break;
    }

    case PaymentEventType.SUBSCRIBE_CANCELED: {
      requireSubscriptionContext(session);
      const existingSubscription = await requireExistingSubscription({
        provider,
        subscriptionId: session.subscriptionId,
        deps,
      });

      if (existingSubscription.status === 'canceled') {
        log.debug('payment: notify ignored canceled subscription', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
          subscriptionNo: existingSubscription.subscriptionNo,
        });
        return {
          response: jsonOk({ message: 'already processed' }),
          outcome: 'already_processed',
          eventType,
        };
      }

      await deps.handleSubscriptionCanceled({
        subscription: existingSubscription,
        session,
        log,
      });
      break;
    }

    default:
      log.warn('payment: notify ignored unsupported event type', {
        provider,
        eventType,
        eventResult: event.eventResult,
      });
      break;
  }

  return {
    response: jsonOk({ message: 'success' }),
    outcome: 'processed',
    eventType,
  };
}
