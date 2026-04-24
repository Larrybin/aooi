import { type PaymentEvent } from '@/domains/billing/domain/payment';

import { toJsonValue } from '@/shared/lib/json';

function toJsonString(value: unknown): string {
  return JSON.stringify(toJsonValue(value));
}

function parseOptionalJson<T>(value: string | null): T | null {
  if (!value?.trim()) return null;
  return JSON.parse(value) as T;
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function serializePaymentWebhookCanonicalEvent(
  event: PaymentEvent
): string {
  return toJsonString(event);
}

export function deserializePaymentWebhookCanonicalEvent(
  serializedEvent: string
): PaymentEvent {
  const event = parseOptionalJson<PaymentEvent>(serializedEvent);
  if (!event) {
    throw new Error('payment webhook canonical event missing');
  }

  const paymentInfo = event.paymentSession.paymentInfo;
  if (paymentInfo?.paidAt) {
    paymentInfo.paidAt = toDateOrNull(paymentInfo.paidAt) || undefined;
  }

  const subscriptionInfo = event.paymentSession.subscriptionInfo;
  if (subscriptionInfo) {
    subscriptionInfo.currentPeriodStart =
      toDateOrNull(subscriptionInfo.currentPeriodStart) ||
      subscriptionInfo.currentPeriodStart;
    subscriptionInfo.currentPeriodEnd =
      toDateOrNull(subscriptionInfo.currentPeriodEnd) ||
      subscriptionInfo.currentPeriodEnd;
    subscriptionInfo.canceledAt =
      toDateOrNull(subscriptionInfo.canceledAt) || undefined;
    subscriptionInfo.canceledEndAt =
      toDateOrNull(subscriptionInfo.canceledEndAt) || undefined;
  }

  return event;
}
