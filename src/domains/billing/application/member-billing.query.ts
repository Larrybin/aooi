import { OrderStatus } from '@/domains/billing/infra/order';
import { type PaymentType } from '@/domains/billing/domain/payment';
import {
  SubscriptionStatus,
} from '@/domains/billing/infra/subscription';
import {
  getCurrentSubscription,
  getSubscriptions,
  getSubscriptionsCount,
} from '@/domains/billing/infra/subscription';
import { getOrders, getOrdersCount } from '@/domains/billing/infra/order';

export async function readMemberBillingOverviewQuery(
  input: {
    userId: string;
    page: number;
    limit: number;
    status?: string;
  }
) {
  const [currentSubscription, subscriptions, total] = await Promise.all([
    getCurrentSubscription(input.userId),
    getSubscriptions({
      userId: input.userId,
      status: input.status,
      page: input.page,
      limit: input.limit,
    }),
    getSubscriptionsCount({
      userId: input.userId,
      status: input.status,
    }),
  ]);

  return {
    currentSubscription,
    subscriptions,
    total,
  };
}

export type MemberSubscriptionRow = Awaited<
  ReturnType<typeof getSubscriptions>
>[number];
export type MemberPaymentRow = Awaited<ReturnType<typeof getOrders>>[number];
export type AdminPaymentRow = Awaited<ReturnType<typeof getOrders>>[number];
export type AdminSubscriptionRow = Awaited<
  ReturnType<typeof getSubscriptions>
>[number];

export const MEMBER_BILLING_ACTIVE_STATUSES = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
] as const;

export const ADMIN_PAYMENT_FILTER_STATUSES = [
  OrderStatus.PAID,
  OrderStatus.CREATED,
  OrderStatus.FAILED,
] as const;

export async function listMemberPaymentsQuery(
  input: {
    userId: string;
    page: number;
    limit: number;
    paymentType?: PaymentType;
  }
) {
  const [orders, total] = await Promise.all([
    getOrders({
      userId: input.userId,
      paymentType: input.paymentType,
      status: OrderStatus.PAID,
      page: input.page,
      limit: input.limit,
    }),
    getOrdersCount({
      userId: input.userId,
      paymentType: input.paymentType,
      status: OrderStatus.PAID,
    }),
  ]);

  return {
    orders,
    total,
  };
}

export async function listAdminPaymentsQuery(
  input: {
    page: number;
    limit: number;
    orderNo?: string;
    paymentType?: PaymentType;
    paymentProvider?: string;
    status?: AdminPaymentRow['status'];
  }
) {
  const [rows, total] = await Promise.all([
    getOrders({
      orderNo: input.orderNo,
      paymentType: input.paymentType,
      paymentProvider: input.paymentProvider,
      status: input.status as OrderStatus | undefined,
      page: input.page,
      limit: input.limit,
      getUser: true,
    }),
    getOrdersCount({
      orderNo: input.orderNo,
      paymentType: input.paymentType,
      paymentProvider: input.paymentProvider,
      status: input.status as OrderStatus | undefined,
    }),
  ]);

  return { rows, total };
}

export async function listAdminSubscriptionsQuery(
  input: {
    page: number;
    limit: number;
    interval?: string;
  }
) {
  const [rows, total] = await Promise.all([
    getSubscriptions({
      interval: input.interval,
      page: input.page,
      limit: input.limit,
      getUser: true,
    }),
    getSubscriptionsCount({
      interval: input.interval,
    }),
  ]);

  return { rows, total };
}

export function isCancelableSubscriptionStatus(status: string | null | undefined) {
  return (
    status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING
  );
}
