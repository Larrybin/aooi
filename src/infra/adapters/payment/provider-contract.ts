import {
  PaymentEventType,
  PaymentStatus,
  WebhookPayloadError,
  type PaymentSession,
} from '@/domains/billing/domain/payment';

export function assertSuccessfulPaymentSessionContract(
  session: PaymentSession
): void {
  if (session.paymentStatus !== PaymentStatus.SUCCESS) return;
  if (!session.paymentInfo) {
    throw new WebhookPayloadError('missing payment info for successful event');
  }
  if (
    session.paymentInfo.paymentAmount === undefined ||
    session.paymentInfo.paymentAmount === null
  ) {
    throw new WebhookPayloadError(
      'missing payment amount for successful event'
    );
  }
  if (!session.paymentInfo.paymentCurrency) {
    throw new WebhookPayloadError(
      'missing payment currency for successful event'
    );
  }
}

export function mapStripeEventTypeToCanonical(
  eventType: string
): PaymentEventType {
  switch (eventType) {
    case 'checkout.session.completed':
      return PaymentEventType.CHECKOUT_SUCCESS;
    case 'invoice.payment_succeeded':
      return PaymentEventType.PAYMENT_SUCCESS;
    case 'invoice.payment_failed':
      return PaymentEventType.PAYMENT_FAILED;
    case 'customer.subscription.updated':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'customer.subscription.deleted':
      return PaymentEventType.SUBSCRIBE_CANCELED;
    default:
      // Refund events (`charge.refunded`) intentionally stay UNKNOWN: Stripe's
      // getPaymentEvent throws WebhookPayloadError for any canonical type it has
      // no session builder for, which would answer 400 before the inbox receipt
      // is written and lose the audit trail handleUnknownEvent gives us today.
      return PaymentEventType.UNKNOWN;
  }
}

export function mapCreemEventTypeToCanonical(
  eventType: string
): PaymentEventType {
  switch (eventType) {
    case 'checkout.completed':
      return PaymentEventType.CHECKOUT_SUCCESS;
    case 'subscription.paid':
      return PaymentEventType.PAYMENT_SUCCESS;
    case 'subscription.update':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'subscription.paused':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'subscription.active':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'subscription.canceled':
      return PaymentEventType.SUBSCRIBE_CANCELED;
    default:
      // Refund events (`refund.created`) intentionally stay UNKNOWN for the same
      // reason as Stripe above: Creem's getPaymentEvent only builds sessions for
      // the canonical types it branches on and throws otherwise.
      return PaymentEventType.UNKNOWN;
  }
}

export function mapPayPalEventTypeToCanonical(
  eventType: string
): PaymentEventType {
  switch (eventType) {
    case 'CHECKOUT.ORDER.APPROVED':
    case 'CHECKOUT.ORDER.COMPLETED':
      return PaymentEventType.CHECKOUT_SUCCESS;
    case 'PAYMENT.CAPTURE.COMPLETED':
    case 'PAYMENT.SALE.COMPLETED':
      return PaymentEventType.PAYMENT_SUCCESS;
    case 'PAYMENT.CAPTURE.DENIED':
    case 'PAYMENT.CAPTURE.DECLINED':
    case 'PAYMENT.SALE.DENIED':
      return PaymentEventType.PAYMENT_FAILED;
    case 'PAYMENT.CAPTURE.REFUNDED':
    case 'PAYMENT.SALE.REFUNDED':
      return PaymentEventType.PAYMENT_REFUNDED;
    case 'BILLING.SUBSCRIPTION.UPDATED':
      return PaymentEventType.SUBSCRIBE_UPDATED;
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      return PaymentEventType.SUBSCRIBE_CANCELED;
    default:
      return PaymentEventType.UNKNOWN;
  }
}
