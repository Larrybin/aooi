import 'server-only';

import { and, count, desc, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { credit, order, subscription } from '@/config/db/schema';
import type { PaymentType } from '@/extensions/payment';

import type { NewCredit } from './credit';
import {
  updateSubscriptionBySubscriptionNo,
  type NewSubscription,
  type UpdateSubscription,
} from './subscription';
import { appendUserToResult, type User, type WithUserId } from './user';

export type Order = typeof order.$inferSelect & {
  user?: User;
};
export type NewOrder = typeof order.$inferInsert;
export type UpdateOrder = Partial<
  Omit<NewOrder, 'id' | 'orderNo' | 'createdAt'>
>;

export enum OrderStatus {
  // processing status
  PENDING = 'pending', // order saved, waiting for checkout
  CREATED = 'created', // checkout success
  // final status
  COMPLETED = 'completed', // checkout completed, but failed
  PAID = 'paid', // order paid success
  FAILED = 'failed', // order paid, but failed
}

/**
 * create order
 */
export async function createOrder(newOrder: NewOrder) {
  const [result] = await db().insert(order).values(newOrder).returning();

  return result;
}

/**
 * get orders
 */
export async function getOrders({
  orderNo,
  userId,
  status,
  getUser,
  paymentType,
  paymentProvider,
  page = 1,
  limit = 30,
}: {
  orderNo?: string;
  userId?: string;
  status?: OrderStatus;
  getUser?: boolean;
  paymentType?: PaymentType;
  paymentProvider?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Order[]> {
  const result = await db()
    .select()
    .from(order)
    .where(
      and(
        orderNo ? eq(order.orderNo, orderNo) : undefined,
        userId ? eq(order.userId, userId) : undefined,
        status ? eq(order.status, status) : undefined,
        paymentType ? eq(order.paymentType, paymentType) : undefined,
        paymentProvider ? eq(order.paymentProvider, paymentProvider) : undefined
      )
    )
    .orderBy(desc(order.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    const withUser = await appendUserToResult(
      result as Array<Order & WithUserId>
    );
    return withUser as Order[];
  }

  return result;
}

/**
 * get orders count
 */
export async function getOrdersCount({
  orderNo,
  userId,
  paymentType,
  status,
  paymentProvider,
}: {
  orderNo?: string;
  userId?: string;
  paymentType?: PaymentType;
  paymentProvider?: string;
  status?: OrderStatus;
} = {}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(order)
    .where(
      and(
        orderNo ? eq(order.orderNo, orderNo) : undefined,
        userId ? eq(order.userId, userId) : undefined,
        status ? eq(order.status, status) : undefined,
        paymentType ? eq(order.paymentType, paymentType) : undefined,
        paymentProvider ? eq(order.paymentProvider, paymentProvider) : undefined
      )
    );

  return result?.count || 0;
}

/**
 * find order by id
 */
export async function findOrderById(id: string) {
  const [result] = await db().select().from(order).where(eq(order.id, id));

  return result;
}

/**
 * find order by order no
 */
export async function findOrderByOrderNo(orderNo: string) {
  const [result] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));

  return result;
}

export async function findOrderByTransactionId({
  provider,
  transactionId,
}: {
  provider: string;
  transactionId: string;
}) {
  const [result] = await db()
    .select()
    .from(order)
    .where(
      and(
        eq(order.transactionId, transactionId),
        eq(order.paymentProvider, provider)
      )
    );

  return result;
}

export async function findOrderByInvoiceId({
  provider,
  invoiceId,
}: {
  provider: string;
  invoiceId: string;
}) {
  const [result] = await db()
    .select()
    .from(order)
    .where(
      and(eq(order.invoiceId, invoiceId), eq(order.paymentProvider, provider))
    );

  return result;
}

/**
 * update order
 */
export async function updateOrderByOrderNo(
  orderNo: string,
  updateOrder: UpdateOrder
) {
  const [result] = await db()
    .update(order)
    .set(updateOrder)
    .where(eq(order.orderNo, orderNo))
    .returning();

  return result;
}

/**
 * update order by order id
 */
export async function updateOrderByOrderId(
  orderId: string,
  updateOrder: UpdateOrder
) {
  const [result] = await db()
    .update(order)
    .set(updateOrder)
    .where(eq(order.id, orderId))
    .returning();

  return result;
}

export async function updateOrderInTransaction({
  orderNo,
  updateOrder,
  newSubscription,
  newCredit,
}: {
  orderNo: string;
  updateOrder: UpdateOrder;
  newSubscription?: NewSubscription;
  newCredit?: NewCredit;
}) {
  if (!orderNo || !updateOrder) {
    throw new Error('orderNo and updateOrder are required');
  }

  // only update order, no need transaction
  if (!newSubscription && !newCredit) {
    return updateOrderByOrderNo(orderNo, updateOrder);
  }

  // need transaction
  const result = await db().transaction(async (tx) => {
    const txResult: {
      order: Order | null;
      subscription: NewSubscription | null;
      credit: NewCredit | null;
    } = {
      order: null,
      subscription: null,
      credit: null,
    };

    // deal with subscription
    if (newSubscription) {
      let existingSubscription: NewSubscription | null = null;
      if (newSubscription.subscriptionId && newSubscription.paymentProvider) {
        // not create subscription with same subscription id and payment provider
        const [existingSubscriptionResult] = await tx
          .select()
          .from(subscription)
          .where(
            and(
              eq(subscription.subscriptionId, newSubscription.subscriptionId),
              eq(subscription.paymentProvider, newSubscription.paymentProvider)
            )
          );

        existingSubscription = existingSubscriptionResult;
      }

      if (!existingSubscription) {
        // create subscription
        const [subscriptionResult] = await tx
          .insert(subscription)
          .values(newSubscription)
          .returning();

        existingSubscription = subscriptionResult;
      }

      txResult.subscription = existingSubscription;
    }

    // deal with credit
    if (newCredit) {
      // not create credit with same order no
      let [existingCredit] = await tx
        .select()
        .from(credit)
        .where(eq(credit.orderNo, orderNo));

      if (!existingCredit) {
        // create credit
        const [creditResult] = await tx
          .insert(credit)
          .values(newCredit)
          .returning();

        existingCredit = creditResult;
      }

      txResult.credit = existingCredit as NewCredit;
    }

    // update order
    const [orderResult] = await tx
      .update(order)
      .set(updateOrder)
      .where(eq(order.orderNo, orderNo))
      .returning();

    txResult.order = orderResult;

    return txResult;
  });

  return result;
}

export async function updateSubscriptionInTransaction({
  subscriptionNo,
  updateSubscription,
  newOrder,
  newCredit,
}: {
  subscriptionNo: string; // subscription unique id in table
  updateSubscription: UpdateSubscription;
  newOrder?: NewOrder;
  newCredit?: NewCredit;
}) {
  if (!subscriptionNo || !updateSubscription) {
    throw new Error('subscriptionNo and updateSubscription are required');
  }

  // only update order, no need transaction
  if (!newOrder && !newCredit) {
    return updateSubscriptionBySubscriptionNo(
      subscriptionNo,
      updateSubscription
    );
  }

  // need transaction
  const result = await db().transaction(async (tx) => {
    const txResult: {
      order: Order | null;
      subscription: UpdateSubscription | null;
      credit: NewCredit | null;
    } = {
      order: null,
      subscription: null,
      credit: null,
    };

    // deal with order
    if (newOrder) {
      const lockProvider = newOrder.paymentProvider?.trim();
      const lockId = (
        newOrder.transactionId ||
        newOrder.invoiceId ||
        ''
      ).trim();
      if (lockProvider && lockId) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${lockProvider}), hashtext(${lockId}))`
        );
      }

      let existingOrder: Order | null = null;
      if (newOrder.transactionId && newOrder.paymentProvider) {
        // not create order with same payment transaction id and payment provider
        const [existingOrderResult] = await tx
          .select()
          .from(order)
          .where(
            and(
              eq(order.transactionId, newOrder.transactionId),
              eq(order.paymentProvider, newOrder.paymentProvider)
            )
          );

        existingOrder = existingOrderResult;
      }

      if (!existingOrder && newOrder.invoiceId && newOrder.paymentProvider) {
        const [existingOrderResult] = await tx
          .select()
          .from(order)
          .where(
            and(
              eq(order.invoiceId, newOrder.invoiceId),
              eq(order.paymentProvider, newOrder.paymentProvider)
            )
          );

        existingOrder = existingOrderResult;
      }

      if (!existingOrder) {
        // create order
        const [orderResult] = await tx
          .insert(order)
          .values(newOrder)
          .returning();

        existingOrder = orderResult;
      }

      txResult.order = existingOrder;
    }

    // deal with credit
    if (newCredit) {
      let existingCredit: NewCredit | null = null;
      if (txResult.order && txResult.order.orderNo) {
        // not create credit with same order no
        const [existingCreditResult] = await tx
          .select()
          .from(credit)
          .where(eq(credit.orderNo, txResult.order.orderNo));

        existingCredit = existingCreditResult as NewCredit;
      }

      if (!existingCredit) {
        // create credit
        const [creditResult] = await tx
          .insert(credit)
          .values(newCredit)
          .returning();

        existingCredit = creditResult;
      }

      txResult.credit = existingCredit;
    }

    // update subscription
    const [subscriptionResult] = await tx
      .update(subscription)
      .set(updateSubscription)
      .where(eq(subscription.subscriptionNo, subscriptionNo))
      .returning();

    txResult.subscription = subscriptionResult;

    return txResult;
  });

  return result;
}
