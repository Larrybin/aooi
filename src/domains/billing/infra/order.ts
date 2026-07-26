import 'server-only';

import type { BillingGrantCredit } from '@/domains/billing/domain/credit';
import type { PaymentType } from '@/domains/billing/domain/payment';
import type { NewEntitlementGrant } from '@/domains/entitlements/infra/grant';
import { db } from '@/infra/adapters/db';
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  notInArray,
  sql,
} from 'drizzle-orm';

import {
  credit,
  entitlementGrant,
  order,
  subscription,
} from '@/config/db/schema';

import {
  updateSubscriptionBySubscriptionNo,
  type NewSubscription,
  type UpdateSubscription,
} from './subscription';
import {
  appendBillingUserToResult,
  type BillingUser,
  type WithUserId,
} from './user-read';

export type Order = typeof order.$inferSelect & {
  user?: BillingUser;
};
type BillingCreditRecord = typeof credit.$inferSelect;
type BillingEntitlementGrantRecord = typeof entitlementGrant.$inferSelect;
export type NewOrder = typeof order.$inferInsert;
export type UpdateOrder = Partial<
  Omit<NewOrder, 'id' | 'orderNo' | 'createdAt'>
>;

export enum OrderStatus {
  // processing status
  PENDING = 'pending', // order saved, waiting for checkout
  CREATED = 'created', // checkout success
  // final status
  COMPLETED = 'completed', // checkout completed
  PAID = 'paid', // order paid success
  FAILED = 'failed', // order paid, but failed
  REFUNDED = 'refunded', // order paid, then refunded / charged back
}

/**
 * Terminal order statuses. Once an order reaches one of these it must never be
 * re-finalized: doing so would re-run credit / subscription / entitlement
 * granting for an order that was already settled.
 */
export const FINAL_ORDER_STATUSES: readonly string[] = [
  OrderStatus.COMPLETED,
  OrderStatus.PAID,
  OrderStatus.FAILED,
  OrderStatus.REFUNDED,
];

export function isFinalOrderStatus(status: string): boolean {
  return FINAL_ORDER_STATUSES.includes(status);
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
    const withUser = await appendBillingUserToResult(
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
 * Mark a settled order as refunded.
 *
 * Only orders that actually took money transition, so a replayed refund webhook
 * cannot drag an order back out of another terminal state. Returns null when no
 * row matched, which the caller reports as "already refunded or never settled"
 * rather than treating it as a failure.
 *
 * Credits and entitlement grants are deliberately untouched: reversing them is a
 * support decision, not something a webhook should do on its own.
 */
export async function markOrderRefundedByOrderNo({
  orderNo,
  refundedAt,
}: {
  orderNo: string;
  refundedAt: Date;
}): Promise<Order | null> {
  const [result] = await db()
    .update(order)
    .set({ status: OrderStatus.REFUNDED, updatedAt: refundedAt })
    .where(
      and(
        eq(order.orderNo, orderNo),
        inArray(order.status, [OrderStatus.PAID, OrderStatus.COMPLETED])
      )
    )
    .returning();

  return result ?? null;
}

/**
 * Reverse what a refunded order granted, without touching what the user already
 * spent.
 *
 * Credits are removed by zeroing the remaining balance rather than deleting the
 * row: consumption bookkeeping in `consumed_detail` references these rows by id,
 * and the balance query already ignores grants with nothing left. The consumed
 * portion stays consumed - a refund does not claw back value that was used, and
 * the description records why the remainder disappeared so the audit trail can
 * tell revocation apart from ordinary consumption.
 *
 * Entitlement grants are matched on the `order:<orderNo>` reason stamped by
 * buildBillingEntitlementGrantForOrder.
 *
 * Both statements only match rows that are still live, so replaying the same
 * refund reverses nothing a second time.
 */
export async function revokeUnconsumedOrderGrantsByOrderNo({
  orderNo,
  revokedAt,
}: {
  orderNo: string;
  revokedAt: Date;
}): Promise<{ revokedCreditRows: number; revokedCredits: number; revokedEntitlementGrants: number }> {
  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('billing_order'), hashtext(${orderNo}))`
    );

    // Read the balances before zeroing them: an UPDATE ... RETURNING hands back
    // the new row, which would report every revoked grant as zero.
    const liveGrants = await tx
      .select({ remainingCredits: credit.remainingCredits })
      .from(credit)
      .where(
        and(
          eq(credit.orderNo, orderNo),
          eq(credit.transactionType, 'grant'),
          gt(credit.remainingCredits, 0)
        )
      );

    if (liveGrants.length > 0) {
      await tx
        .update(credit)
        .set({
          remainingCredits: 0,
          description: `revoked: order ${orderNo} refunded`,
          updatedAt: revokedAt,
        })
        .where(
          and(
            eq(credit.orderNo, orderNo),
            eq(credit.transactionType, 'grant'),
            gt(credit.remainingCredits, 0)
          )
        );
    }

    const revokedCredits = liveGrants.reduce(
      (total, row) => total + row.remainingCredits,
      0
    );

    const revokedEntitlementGrants = await tx
      .update(entitlementGrant)
      .set({ status: 'revoked', revokedAt })
      .where(
        and(
          eq(entitlementGrant.reason, `order:${orderNo}`),
          eq(entitlementGrant.status, 'active')
        )
      )
      .returning({ id: entitlementGrant.id });

    return {
      revokedCreditRows: liveGrants.length,
      revokedCredits,
      revokedEntitlementGrants: revokedEntitlementGrants.length,
    };
  });
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
  newEntitlementGrant,
}: {
  orderNo: string;
  updateOrder: UpdateOrder;
  newSubscription?: NewSubscription;
  newCredit?: BillingGrantCredit;
  newEntitlementGrant?: NewEntitlementGrant;
}) {
  if (!orderNo || !updateOrder) {
    throw new Error('orderNo and updateOrder are required');
  }

  // only update order, no need transaction
  if (!newSubscription && !newCredit && !newEntitlementGrant) {
    return updateOrderByOrderNo(orderNo, updateOrder);
  }

  // need transaction
  const result = await db().transaction(async (tx) => {
    const txResult: {
      order: Order | null;
      subscription: NewSubscription | null;
      credit: BillingCreditRecord | null;
      entitlementGrant: BillingEntitlementGrantRecord | null;
    } = {
      order: null,
      subscription: null,
      credit: null,
      entitlementGrant: null,
    };

    // Serialize every settlement path for this order. The browser `successUrl`
    // callback and the provider webhook both reach this transaction and share no
    // other lock, so without this the check-then-insert blocks below race and
    // grant credits / subscriptions / entitlements more than once.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('billing_order'), hashtext(${orderNo}))`
    );

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

      // The caller stamped the order and the credit with the subscription number
      // it generated before this transaction ran. If an existing subscription won
      // instead, that number was never persisted, so repoint both at the row that
      // actually exists rather than leaving a dangling reference.
      const settledSubscriptionNo = existingSubscription?.subscriptionNo;
      if (
        settledSubscriptionNo &&
        settledSubscriptionNo !== newSubscription.subscriptionNo
      ) {
        updateOrder = { ...updateOrder, subscriptionNo: settledSubscriptionNo };
        if (newCredit?.subscriptionNo) {
          newCredit = { ...newCredit, subscriptionNo: settledSubscriptionNo };
        }
      }
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

      txResult.credit = existingCredit as BillingCreditRecord;
    }

    if (newEntitlementGrant) {
      let [existingGrant] = await tx
        .select()
        .from(entitlementGrant)
        .where(
          and(
            eq(entitlementGrant.userId, newEntitlementGrant.userId),
            eq(entitlementGrant.siteKey, newEntitlementGrant.siteKey),
            eq(entitlementGrant.productKey, newEntitlementGrant.productKey),
            eq(entitlementGrant.environment, newEntitlementGrant.environment),
            eq(entitlementGrant.source, newEntitlementGrant.source),
            eq(entitlementGrant.reason, newEntitlementGrant.reason)
          )
        );

      if (!existingGrant) {
        const [createdGrant] = await tx
          .insert(entitlementGrant)
          .values(newEntitlementGrant)
          .returning();
        existingGrant = createdGrant;
      }

      txResult.entitlementGrant = existingGrant;
    }

    // Finalize the order only if it is not already in a terminal state. The
    // caller's `shouldIgnoreFinalOrder` guard runs against a snapshot read
    // before an outbound provider round-trip, so it can be stale by the time we
    // get here; this compare-and-set is the authoritative check.
    const [orderResult] = await tx
      .update(order)
      .set(updateOrder)
      .where(
        and(
          eq(order.orderNo, orderNo),
          notInArray(order.status, [...FINAL_ORDER_STATUSES])
        )
      )
      .returning();

    if (orderResult) {
      txResult.order = orderResult;
    } else {
      // A concurrent settlement already finalized this order. Under the advisory
      // lock above the blocks before this point resolved to the rows that
      // settlement created, so this is the idempotent no-op path, not an error.
      const [currentOrder] = await tx
        .select()
        .from(order)
        .where(eq(order.orderNo, orderNo));

      txResult.order = currentOrder ?? null;
    }

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
  newCredit?: BillingGrantCredit;
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
      credit: BillingCreditRecord | null;
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
      let existingCredit: BillingCreditRecord | null = null;
      if (txResult.order && txResult.order.orderNo) {
        // not create credit with same order no
        const [existingCreditResult] = await tx
          .select()
          .from(credit)
          .where(eq(credit.orderNo, txResult.order.orderNo));

        existingCredit = existingCreditResult as BillingCreditRecord;
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
