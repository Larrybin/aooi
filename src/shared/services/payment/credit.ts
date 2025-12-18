import 'server-only';

import { PaymentType } from '@/extensions/payment';

import { getSnowId, getUuid } from '@/shared/lib/hash';
import {
  calculateCreditExpirationTime,
  CreditStatus,
  CreditTransactionScene,
  CreditTransactionType,
  type NewCredit,
} from '@/shared/models/credit';
import type { SubscriptionInfo } from '@/extensions/payment';

export function getCreditTransactionSceneForPaymentType(
  paymentType: PaymentType
): CreditTransactionScene {
  switch (paymentType) {
    case PaymentType.SUBSCRIPTION:
      return CreditTransactionScene.SUBSCRIPTION;
    case PaymentType.RENEW:
      return CreditTransactionScene.RENEWAL;
    case PaymentType.ONE_TIME:
    default:
      return CreditTransactionScene.PAYMENT;
  }
}

export function buildGrantCreditForOrder({
  order,
  subscriptionNo,
  subscriptionInfo,
}: {
  order: {
    userId: string;
    userEmail?: string | null;
    orderNo?: string | null;
    paymentType: PaymentType;
    creditsAmount?: number | null;
    creditsValidDays?: number | null;
  };
  subscriptionNo?: string;
  subscriptionInfo?: SubscriptionInfo;
}): NewCredit | undefined {
  if (!order.creditsAmount || order.creditsAmount <= 0) {
    return undefined;
  }

  const credits = order.creditsAmount;
  const expiresAt =
    credits > 0
      ? calculateCreditExpirationTime({
          creditsValidDays: order.creditsValidDays || 0,
          currentPeriodEnd: subscriptionInfo?.currentPeriodEnd,
        })
      : null;

  return {
    id: getUuid(),
    userId: order.userId,
    userEmail: order.userEmail,
    orderNo: order.orderNo,
    subscriptionNo,
    transactionNo: getSnowId(),
    transactionType: CreditTransactionType.GRANT,
    transactionScene: getCreditTransactionSceneForPaymentType(order.paymentType),
    credits,
    remainingCredits: credits,
    description: 'Grant credit',
    expiresAt,
    status: CreditStatus.ACTIVE,
  };
}
