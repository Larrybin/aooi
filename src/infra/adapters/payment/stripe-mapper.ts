import {
  PaymentEventType,
  PaymentStatus,
  SubscriptionCycleType,
  SubscriptionStatus,
  type PaymentEvent,
  type PaymentInterval,
  type PaymentSession,
  type SubscriptionInfo,
} from '@/domains/billing/domain/payment';
import type Stripe from 'stripe';

import { UpstreamError } from '@/shared/lib/api/errors';

export function mapStripeStatus(
  session: Stripe.Response<Stripe.Checkout.Session>
): PaymentStatus {
  switch (session.status) {
    case 'complete':
      switch (session.payment_status) {
        case 'paid':
        case 'no_payment_required':
          return PaymentStatus.SUCCESS;
        case 'unpaid':
          return PaymentStatus.PROCESSING;
        default:
          throw new UpstreamError(
            502,
            `Unknown Stripe payment status: ${session.payment_status}`
          );
      }
    case 'expired':
      return PaymentStatus.CANCELED;
    case 'open':
      return PaymentStatus.PROCESSING;
    default:
      throw new UpstreamError(502, `Unknown Stripe status: ${session.status}`);
  }
}

export function buildStripeSubscriptionInfo(
  subscription: Stripe.Response<Stripe.Subscription>
): SubscriptionInfo {
  const data = subscription.items.data[0];

  const subscriptionInfo: SubscriptionInfo = {
    subscriptionId: subscription.id,
    productId: data.price.product as string,
    planId: data.price.id,
    description: '',
    amount: data.price.unit_amount || 0,
    currency: data.price.currency,
    currentPeriodStart: new Date(data.current_period_start * 1000),
    currentPeriodEnd: new Date(data.current_period_end * 1000),
    interval: data.plan.interval as PaymentInterval,
    intervalCount: data.plan.interval_count || 1,
    metadata: subscription.metadata ? { ...subscription.metadata } : undefined,
  };

  if (subscription.status === 'active') {
    if (subscription.cancel_at) {
      subscriptionInfo.status = SubscriptionStatus.PENDING_CANCEL;
      subscriptionInfo.canceledAt = new Date(
        (subscription.canceled_at || 0) * 1000
      );
      subscriptionInfo.canceledEndAt = new Date(subscription.cancel_at * 1000);
      subscriptionInfo.canceledReason =
        subscription.cancellation_details?.comment || '';
      subscriptionInfo.canceledReasonType =
        subscription.cancellation_details?.feedback || '';
    } else {
      subscriptionInfo.status = SubscriptionStatus.ACTIVE;
    }
    return subscriptionInfo;
  }

  if (subscription.status === 'canceled') {
    subscriptionInfo.status = SubscriptionStatus.CANCELED;
    subscriptionInfo.canceledAt = new Date(
      (subscription.canceled_at || 0) * 1000
    );
    subscriptionInfo.canceledReason =
      subscription.cancellation_details?.comment || '';
    subscriptionInfo.canceledReasonType =
      subscription.cancellation_details?.feedback || '';
    return subscriptionInfo;
  }

  throw new UpstreamError(
    502,
    `Unknown Stripe subscription status: ${subscription.status}`
  );
}

export async function buildStripePaymentSessionFromCheckoutSession({
  provider,
  session,
  retrieveSubscription,
}: {
  provider: string;
  session: Stripe.Response<Stripe.Checkout.Session>;
  retrieveSubscription: (
    subscriptionId: string
  ) => Promise<Stripe.Response<Stripe.Subscription>>;
}): Promise<PaymentSession> {
  const result: PaymentSession = {
    provider,
    paymentStatus: mapStripeStatus(session),
    paymentInfo: {
      transactionId: session.id,
      discountCode: '',
      discountAmount: undefined,
      discountCurrency: undefined,
      paymentAmount: session.amount_total || 0,
      paymentCurrency: session.currency || '',
      paymentEmail:
        session.customer_email || session.customer_details?.email || undefined,
      paymentUserName: session.customer_details?.name || '',
      paymentUserId: session.customer
        ? (session.customer as string)
        : undefined,
      paidAt: session.created ? new Date(session.created * 1000) : undefined,
      invoiceId: session.invoice ? (session.invoice as string) : undefined,
      invoiceUrl: '',
    },
    paymentResult: session,
    metadata: session.metadata ? { ...session.metadata } : undefined,
  };

  if (!session.subscription) {
    return result;
  }

  const subscription = await retrieveSubscription(
    session.subscription as string
  );
  result.subscriptionId = subscription.id;
  result.subscriptionInfo = buildStripeSubscriptionInfo(subscription);
  result.subscriptionResult = subscription;
  return result;
}

export async function buildStripePaymentSessionFromInvoice({
  provider,
  invoice,
  retrieveSubscription,
}: {
  provider: string;
  invoice: Stripe.Response<Stripe.Invoice>;
  retrieveSubscription: (
    subscriptionId: string
  ) => Promise<Stripe.Response<Stripe.Subscription>>;
}): Promise<PaymentSession> {
  let subscription: Stripe.Response<Stripe.Subscription> | undefined;

  if (invoice.lines.data.length > 0) {
    const data = invoice.lines.data[0];
    let subscriptionId = '';

    if (data.subscription) {
      subscriptionId = data.subscription as string;
    } else if (
      data.parent &&
      data.parent.subscription_item_details &&
      data.parent.subscription_item_details.subscription
    ) {
      subscriptionId = data.parent.subscription_item_details
        .subscription as string;
    }

    if (subscriptionId) {
      subscription = await retrieveSubscription(subscriptionId);
    }
  }

  const result: PaymentSession = {
    provider,
    paymentStatus: PaymentStatus.SUCCESS,
    paymentInfo: {
      transactionId: invoice.id,
      discountCode: '',
      discountAmount: undefined,
      discountCurrency: undefined,
      paymentAmount: invoice.amount_paid,
      paymentCurrency: invoice.currency,
      paymentEmail: invoice.customer_email || '',
      paymentUserName: invoice.customer_name || '',
      paymentUserId: invoice.customer
        ? (invoice.customer as string)
        : undefined,
      paidAt: invoice.created ? new Date(invoice.created * 1000) : undefined,
      invoiceId: invoice.id,
      invoiceUrl: invoice.hosted_invoice_url || '',
      subscriptionCycleType:
        invoice.billing_reason === 'subscription_create'
          ? SubscriptionCycleType.CREATE
          : invoice.billing_reason === 'subscription_cycle'
            ? SubscriptionCycleType.RENEWAL
            : undefined,
    },
    paymentResult: invoice,
    metadata: invoice.metadata ? { ...invoice.metadata } : undefined,
  };

  if (!subscription) {
    return result;
  }

  result.subscriptionId = subscription.id;
  result.subscriptionInfo = buildStripeSubscriptionInfo(subscription);
  result.subscriptionResult = subscription;
  return result;
}

export function buildStripeFailedPaymentSessionFromInvoice({
  provider,
  invoice,
  event,
}: {
  provider: string;
  invoice: Stripe.Response<Stripe.Invoice>;
  event: Stripe.Event;
}): PaymentSession {
  return {
    provider,
    paymentStatus: PaymentStatus.FAILED,
    paymentResult: invoice,
    metadata: {
      ...(invoice.metadata ? { ...invoice.metadata } : {}),
      event_type: event.type,
      event_id: event.id,
    },
  };
}

export function buildStripePaymentSessionFromSubscription({
  provider,
  subscription,
}: {
  provider: string;
  subscription: Stripe.Response<Stripe.Subscription>;
}): PaymentSession {
  return {
    provider,
    subscriptionId: subscription.id,
    subscriptionInfo: buildStripeSubscriptionInfo(subscription),
    subscriptionResult: subscription,
  };
}

export function buildStripeUnknownPaymentEvent({
  provider,
  event,
}: {
  provider: string;
  event: Stripe.Event;
}): PaymentEvent {
  return {
    eventType: PaymentEventType.UNKNOWN,
    eventResult: event,
    paymentSession: {
      provider,
      paymentStatus: PaymentStatus.PROCESSING,
      paymentResult: event,
      metadata: {
        event_type: event.type,
        event_id: event.id,
      },
    },
  };
}
