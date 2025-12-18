import 'server-only';

import {
  PaymentSession,
  PaymentStatus,
  PaymentType,
} from '@/extensions/payment';

import { getSnowId, getUuid } from '@/shared/lib/hash';
import type { NewCredit } from '@/shared/models/credit';
import {
  type NewOrder,
  type Order,
  OrderStatus,
  type UpdateOrder,
  updateOrderByOrderNo,
  updateOrderInTransaction,
  updateSubscriptionInTransaction,
} from '@/shared/models/order';
import type { NewSubscription } from '@/shared/models/subscription';
import {
  SubscriptionStatus,
  type Subscription,
  type UpdateSubscription,
  updateSubscriptionBySubscriptionNo,
} from '@/shared/models/subscription';

import { buildGrantCreditForOrder } from './credit';

function toCreditGrantOrder(order: Order) {
  return {
    userId: order.userId,
    userEmail: order.userEmail,
    orderNo: order.orderNo,
    paymentType: order.paymentType as PaymentType,
    creditsAmount: order.creditsAmount,
    creditsValidDays: order.creditsValidDays,
  };
}

/**
 * Handle checkout success (one-time payment or subscription first payment)
 */
export async function handleCheckoutSuccess({
  order,
  session,
}: {
  order: Order; // checkout order
  session: PaymentSession; // payment session
}) {
  const orderNo = order.orderNo;
  if (!orderNo) {
    throw new Error('invalid order');
  }

  if (order.paymentType === PaymentType.SUBSCRIPTION) {
    if (!session.subscriptionId || !session.subscriptionInfo) {
      throw new Error('subscription id or subscription info not found');
    }
  }

  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    const updateOrder: UpdateOrder = {
      status: OrderStatus.PAID,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: session.paymentInfo?.paymentAmount,
      paymentCurrency: session.paymentInfo?.paymentCurrency,
      discountAmount: session.paymentInfo?.discountAmount,
      discountCurrency: session.paymentInfo?.discountCurrency,
      discountCode: session.paymentInfo?.discountCode,
      paymentEmail: session.paymentInfo?.paymentEmail,
      paidAt: session.paymentInfo?.paidAt,
      invoiceId: session.paymentInfo?.invoiceId,
      invoiceUrl: session.paymentInfo?.invoiceUrl,
      subscriptionNo: '',
      transactionId: session.paymentInfo?.transactionId,
      paymentUserName: session.paymentInfo?.paymentUserName,
      paymentUserId: session.paymentInfo?.paymentUserId,
    };

    let newSubscription: NewSubscription | undefined = undefined;
    const subscriptionInfo = session.subscriptionInfo;

    if (subscriptionInfo) {
      newSubscription = {
        id: getUuid(),
        subscriptionNo: getSnowId(),
        userId: order.userId,
        userEmail: order.paymentEmail || order.userEmail,
        status: subscriptionInfo.status || SubscriptionStatus.ACTIVE,
        paymentProvider: order.paymentProvider,
        subscriptionId: subscriptionInfo.subscriptionId,
        subscriptionResult: JSON.stringify(session.subscriptionResult),
        productId: order.productId,
        description: subscriptionInfo.description || 'Subscription Created',
        amount: subscriptionInfo.amount,
        currency: subscriptionInfo.currency,
        interval: subscriptionInfo.interval,
        intervalCount: subscriptionInfo.intervalCount,
        trialPeriodDays: subscriptionInfo.trialPeriodDays,
        currentPeriodStart: subscriptionInfo.currentPeriodStart,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
        billingUrl: subscriptionInfo.billingUrl,
        planName: order.planName || order.productName,
        productName: order.productName,
        creditsAmount: order.creditsAmount,
        creditsValidDays: order.creditsValidDays,
        paymentProductId: order.paymentProductId,
        paymentUserId: session.paymentInfo?.paymentUserId,
      };

      updateOrder.subscriptionNo = newSubscription.subscriptionNo;
      updateOrder.subscriptionId = session.subscriptionId;
      updateOrder.subscriptionResult = JSON.stringify(session.subscriptionResult);
    }

    const newCredit = buildGrantCreditForOrder({
      order: toCreditGrantOrder(order),
      subscriptionNo: newSubscription?.subscriptionNo,
      subscriptionInfo,
    });

    await updateOrderInTransaction({
      orderNo,
      updateOrder,
      newSubscription,
      newCredit,
    });
  } else if (
    session.paymentStatus === PaymentStatus.FAILED ||
    session.paymentStatus === PaymentStatus.CANCELED
  ) {
    await updateOrderByOrderNo(orderNo, {
      status: OrderStatus.FAILED,
      paymentResult: JSON.stringify(session.paymentResult),
    });
  } else if (session.paymentStatus === PaymentStatus.PROCESSING) {
    await updateOrderByOrderNo(orderNo, {
      paymentResult: JSON.stringify(session.paymentResult),
    });
  } else {
    throw new Error('unknown payment status');
  }
}

/**
 * Handle payment success
 */
export async function handlePaymentSuccess({
  order,
  session,
}: {
  order: Order; // checkout order
  session: PaymentSession; // payment session
}) {
  const orderNo = order.orderNo;
  if (!orderNo) {
    throw new Error('invalid order');
  }

  if (order.paymentType === PaymentType.SUBSCRIPTION) {
    if (!session.subscriptionId || !session.subscriptionInfo) {
      throw new Error('subscription id or subscription info not found');
    }
  }

  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    const updateOrder: UpdateOrder = {
      status: OrderStatus.PAID,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: session.paymentInfo?.paymentAmount,
      paymentCurrency: session.paymentInfo?.paymentCurrency,
      discountAmount: session.paymentInfo?.discountAmount,
      discountCurrency: session.paymentInfo?.discountCurrency,
      discountCode: session.paymentInfo?.discountCode,
      paymentEmail: session.paymentInfo?.paymentEmail,
      paymentUserName: session.paymentInfo?.paymentUserName,
      paymentUserId: session.paymentInfo?.paymentUserId,
      paidAt: session.paymentInfo?.paidAt,
      invoiceId: session.paymentInfo?.invoiceId,
      invoiceUrl: session.paymentInfo?.invoiceUrl,
    };

    let newSubscription: NewSubscription | undefined = undefined;
    const subscriptionInfo = session.subscriptionInfo;

    if (subscriptionInfo) {
      newSubscription = {
        id: getUuid(),
        subscriptionNo: getSnowId(),
        userId: order.userId,
        userEmail: order.paymentEmail || order.userEmail,
        status: SubscriptionStatus.ACTIVE,
        paymentProvider: order.paymentProvider,
        subscriptionId: subscriptionInfo.subscriptionId,
        subscriptionResult: JSON.stringify(session.subscriptionResult),
        productId: order.productId,
        description: subscriptionInfo.description,
        amount: subscriptionInfo.amount,
        currency: subscriptionInfo.currency,
        interval: subscriptionInfo.interval,
        intervalCount: subscriptionInfo.intervalCount,
        trialPeriodDays: subscriptionInfo.trialPeriodDays,
        currentPeriodStart: subscriptionInfo.currentPeriodStart,
        currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
        planName: order.planName || order.productName,
        billingUrl: subscriptionInfo.billingUrl,
        productName: order.productName,
        creditsAmount: order.creditsAmount,
        creditsValidDays: order.creditsValidDays,
        paymentProductId: order.paymentProductId,
        paymentUserId: session.paymentInfo?.paymentUserId,
      };

      updateOrder.subscriptionId = session.subscriptionId;
      updateOrder.subscriptionResult = JSON.stringify(session.subscriptionResult);
    }

    const newCredit = buildGrantCreditForOrder({
      order: toCreditGrantOrder(order),
      subscriptionNo: newSubscription?.subscriptionNo,
      subscriptionInfo,
    });

    await updateOrderInTransaction({
      orderNo,
      updateOrder,
      newSubscription,
      newCredit,
    });
  } else {
    throw new Error('unknown payment status');
  }
}

export async function handleSubscriptionRenewal({
  subscription,
  session,
}: {
  subscription: Subscription; // subscription
  session: PaymentSession; // payment session
}) {
  const subscriptionNo = subscription.subscriptionNo;
  if (!subscriptionNo || !subscription.amount || !subscription.currency) {
    throw new Error('invalid subscription');
  }

  if (!session.subscriptionId || !session.subscriptionInfo) {
    throw new Error('invalid payment session');
  }
  if (session.subscriptionId !== subscription.subscriptionId) {
    throw new Error('subscription id mismatch');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo ||
    !subscriptionInfo.currentPeriodStart ||
    !subscriptionInfo.currentPeriodEnd
  ) {
    throw new Error('invalid subscription info');
  }

  if (session.paymentStatus === PaymentStatus.SUCCESS) {
    const updateSubscription: UpdateSubscription = {
      currentPeriodStart: subscriptionInfo.currentPeriodStart,
      currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
    };

    const orderNo = getSnowId();
    const currentTime = new Date();

    const order: NewOrder = {
      id: getUuid(),
      orderNo: orderNo,
      userId: subscription.userId,
      userEmail: subscription.userEmail,
      status: OrderStatus.PAID,
      amount: subscription.amount,
      currency: subscription.currency,
      productId: subscription.productId,
      paymentType: PaymentType.RENEW,
      paymentInterval: subscription.interval,
      paymentProvider: session.provider || subscription.paymentProvider,
      checkoutInfo: '',
      createdAt: currentTime,
      productName: subscription.productName,
      description: 'Subscription Renewal',
      callbackUrl: '',
      creditsAmount: subscription.creditsAmount,
      creditsValidDays: subscription.creditsValidDays,
      planName: subscription.planName || '',
      paymentProductId: subscription.paymentProductId,
      paymentResult: JSON.stringify(session.paymentResult),
      paymentAmount: session.paymentInfo?.paymentAmount,
      paymentCurrency: session.paymentInfo?.paymentCurrency,
      discountAmount: session.paymentInfo?.discountAmount,
      discountCurrency: session.paymentInfo?.discountCurrency,
      discountCode: session.paymentInfo?.discountCode,
      paymentEmail: session.paymentInfo?.paymentEmail,
      paymentUserId: session.paymentInfo?.paymentUserId,
      paidAt: session.paymentInfo?.paidAt,
      invoiceId: session.paymentInfo?.invoiceId,
      invoiceUrl: session.paymentInfo?.invoiceUrl,
      subscriptionNo: subscription.subscriptionNo,
      transactionId: session.paymentInfo?.transactionId,
      paymentUserName: session.paymentInfo?.paymentUserName,
      subscriptionId: session.subscriptionId,
      subscriptionResult: JSON.stringify(session.subscriptionResult),
    };

    // NOTE: renewal credits must be tagged as `renewal` for audit/reporting.
    const newCredit: NewCredit | undefined = buildGrantCreditForOrder({
      order: {
        userId: order.userId,
        userEmail: order.userEmail,
        orderNo: order.orderNo,
        paymentType: PaymentType.RENEW,
        creditsAmount: order.creditsAmount,
        creditsValidDays: order.creditsValidDays,
      },
      subscriptionNo: subscription.subscriptionNo,
      subscriptionInfo,
    });

    await updateSubscriptionInTransaction({
      subscriptionNo,
      updateSubscription,
      newOrder: order,
      newCredit,
    });
  } else {
    throw new Error('unknown payment status');
  }
}

export async function handleSubscriptionUpdated({
  subscription,
  session,
}: {
  subscription: Subscription; // subscription
  session: PaymentSession; // payment session
}) {
  const subscriptionNo = subscription.subscriptionNo;
  if (!subscriptionNo || !subscription.amount || !subscription.currency) {
    throw new Error('invalid subscription');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (!subscriptionInfo || !subscriptionInfo.status) {
    throw new Error('invalid subscription info');
  }

  const updateSubscriptionStatus: SubscriptionStatus = subscriptionInfo.status;

  await updateSubscriptionBySubscriptionNo(subscriptionNo, {
    status: updateSubscriptionStatus,
    currentPeriodStart: subscriptionInfo.currentPeriodStart,
    currentPeriodEnd: subscriptionInfo.currentPeriodEnd,
    canceledAt: subscriptionInfo.canceledAt || null,
    canceledEndAt: subscriptionInfo.canceledEndAt || null,
    canceledReason: subscriptionInfo.canceledReason || '',
    canceledReasonType: subscriptionInfo.canceledReasonType || '',
  });
}

export async function handleSubscriptionCanceled({
  subscription,
  session,
}: {
  subscription: Subscription; // subscription
  session: PaymentSession; // payment session
}) {
  const subscriptionNo = subscription.subscriptionNo;
  if (!subscriptionNo || !subscription.amount || !subscription.currency) {
    throw new Error('invalid subscription');
  }

  const subscriptionInfo = session.subscriptionInfo;
  if (
    !subscriptionInfo ||
    !subscriptionInfo.status ||
    !subscriptionInfo.canceledAt
  ) {
    throw new Error('invalid subscription info');
  }

  await updateSubscriptionBySubscriptionNo(subscriptionNo, {
    status: SubscriptionStatus.CANCELED,
    canceledAt: subscriptionInfo.canceledAt,
    canceledEndAt: subscriptionInfo.canceledEndAt,
    canceledReason: subscriptionInfo.canceledReason,
    canceledReasonType: subscriptionInfo.canceledReasonType,
  });
}
