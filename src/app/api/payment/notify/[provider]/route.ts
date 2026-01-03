import {
  PaymentEventType,
  SubscriptionCycleType,
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
} from '@/extensions/payment';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
  OrderStatus,
} from '@/shared/models/order';
import {
  findSubscriptionByProviderSubscriptionId,
  SubscriptionStatus,
} from '@/shared/models/subscription';
import { PaymentNotifyParamsSchema } from '@/shared/schemas/api/payment/notify';
import {
  getPaymentService,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/shared/services/payment';

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

function buildSubscriptionRenewalDedupeKey(input: {
  provider: string;
  subscriptionId: string;
  subscriptionInfo: { currentPeriodStart: unknown; currentPeriodEnd: unknown };
}): string | null {
  const start = toISOStringOrNull(input.subscriptionInfo.currentPeriodStart);
  const end = toISOStringOrNull(input.subscriptionInfo.currentPeriodEnd);
  if (!start || !end) return null;
  return `renewal:${input.provider}:${input.subscriptionId}:${start}:${end}`;
}

export const POST = withApi(
  async (
    req: Request,
    { params }: { params: Promise<{ provider: string }> }
  ) => {
    const api = createApiContext(req);
    const { log } = api;
    const { provider } = await api.parseParams(
      params,
      PaymentNotifyParamsSchema
    );

    const paymentService = await getPaymentService();
    const paymentProvider = paymentService.getProvider(provider);
    if (!paymentProvider) {
      throw new NotFoundError('payment provider not found');
    }

    let event;
    try {
      event = await paymentProvider.getPaymentEvent({ req });
    } catch (err: unknown) {
      if (err instanceof WebhookVerificationError) {
        log.warn('payment: webhook verification failed', {
          provider,
          eventType: 'unknown',
        });
        throw new UnauthorizedError(err.message);
      }
      if (err instanceof WebhookPayloadError) {
        log.warn('payment: webhook payload invalid', {
          provider,
          eventType: 'unknown',
        });
        throw new BadRequestError(err.message);
      }
      if (err instanceof WebhookConfigError) {
        throw err;
      }
      throw err;
    }
    if (!event) {
      throw new BadRequestError('payment event not found');
    }

    const eventType = event.eventType;
    if (!eventType) {
      throw new BadRequestError('event type not found');
    }

    // payment session
    const session = event.paymentSession;
    if (!session) {
      throw new BadRequestError('payment session not found');
    }

    // console.log('notify payment session', session);

    if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
      const orderNoValue = session.metadata?.order_no;
      const orderNo =
        typeof orderNoValue === 'string' ? orderNoValue.trim() : '';

      if (!orderNo) {
        throw new BadRequestError('order no not found');
      }

      const order = await findOrderByOrderNo(orderNo);
      if (!order) {
        throw new NotFoundError('order not found');
      }

      // Idempotency guard: if the order is already finalized, return success early.
      if (
        order.status === OrderStatus.PAID ||
        order.status === OrderStatus.FAILED ||
        order.status === OrderStatus.COMPLETED
      ) {
        return jsonOk({ message: 'already processed' });
      }

      await handleCheckoutSuccess({
        order,
        session,
        log,
      });
    } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
      // only handle subscription payment
      if (session.subscriptionId && session.subscriptionInfo) {
        if (
          session.paymentInfo?.subscriptionCycleType ===
          SubscriptionCycleType.RENEWAL
        ) {
          const rawTransactionId = session.paymentInfo?.transactionId?.trim();
          const rawInvoiceId = session.paymentInfo?.invoiceId?.trim();

          if (rawTransactionId) {
            const existingOrder = await findOrderByTransactionId({
              provider,
              transactionId: rawTransactionId,
            });
            if (existingOrder) {
              log.debug('payment: notify ignored duplicate renewal', {
                provider,
                eventType,
                transactionId: rawTransactionId,
              });
              return jsonOk({ message: 'already processed' });
            }
          }

          if (rawInvoiceId && rawInvoiceId !== rawTransactionId) {
            const existingOrder = await findOrderByInvoiceId({
              provider,
              invoiceId: rawInvoiceId,
            });
            if (existingOrder) {
              log.debug('payment: notify ignored duplicate renewal', {
                provider,
                eventType,
                invoiceId: rawInvoiceId,
              });
              return jsonOk({ message: 'already processed' });
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
            return jsonOk({ message: 'ignored' });
          }

          if (!rawTransactionId && !rawInvoiceId) {
            const existingOrder = await findOrderByTransactionId({
              provider,
              transactionId: dedupeTransactionId,
            });
            if (existingOrder) {
              log.debug('payment: notify ignored duplicate renewal', {
                provider,
                eventType,
                transactionId: dedupeTransactionId,
              });
              return jsonOk({ message: 'already processed' });
            }

            log.warn(
              'payment: renewal idempotency keys missing, using fallback',
              {
                provider,
                eventType,
                subscriptionId: session.subscriptionId,
              }
            );
          }

          const existingSubscription =
            await findSubscriptionByProviderSubscriptionId({
              provider: provider,
              subscriptionId: session.subscriptionId,
            });
          if (!existingSubscription) {
            throw new NotFoundError('subscription not found');
          }

          const paymentInfo = session.paymentInfo;
          if (!paymentInfo) {
            log.error('payment: renewal missing payment info, ignored', {
              provider,
              eventType,
              subscriptionId: session.subscriptionId,
            });
            return jsonOk({ message: 'ignored' });
          }

          const sessionForRenewal = {
            ...session,
            paymentInfo: {
              ...paymentInfo,
              transactionId: dedupeTransactionId,
              invoiceId: rawInvoiceId || paymentInfo.invoiceId,
            },
          };

          await handleSubscriptionRenewal({
            subscription: existingSubscription,
            session: sessionForRenewal,
            log,
          });
        } else {
          log.debug('payment: notify ignored subscription first payment', {
            provider,
            eventType,
          });
        }
      } else {
        log.debug('payment: notify ignored one-time payment', {
          provider,
          eventType,
        });
      }
    } else if (eventType === PaymentEventType.SUBSCRIBE_UPDATED) {
      if (!session.subscriptionId || !session.subscriptionInfo) {
        throw new BadRequestError(
          'subscription id or subscription info not found'
        );
      }

      const existingSubscription =
        await findSubscriptionByProviderSubscriptionId({
          provider: provider,
          subscriptionId: session.subscriptionId,
        });
      if (!existingSubscription) {
        throw new NotFoundError('subscription not found');
      }

      if (existingSubscription.status === SubscriptionStatus.CANCELED) {
        log.debug('payment: notify ignored canceled subscription', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
          subscriptionNo: existingSubscription.subscriptionNo,
        });
        return jsonOk({ message: 'already processed' });
      }

      await handleSubscriptionUpdated({
        subscription: existingSubscription,
        session,
        log,
      });
    } else if (eventType === PaymentEventType.SUBSCRIBE_CANCELED) {
      if (!session.subscriptionId || !session.subscriptionInfo) {
        throw new BadRequestError(
          'subscription id or subscription info not found'
        );
      }

      const existingSubscription =
        await findSubscriptionByProviderSubscriptionId({
          provider: provider,
          subscriptionId: session.subscriptionId,
        });
      if (!existingSubscription) {
        throw new NotFoundError('subscription not found');
      }

      if (existingSubscription.status === SubscriptionStatus.CANCELED) {
        log.debug('payment: notify ignored canceled subscription', {
          provider,
          eventType,
          subscriptionId: session.subscriptionId,
          subscriptionNo: existingSubscription.subscriptionNo,
        });
        return jsonOk({ message: 'already processed' });
      }

      await handleSubscriptionCanceled({
        subscription: existingSubscription,
        session,
        log,
      });
    } else {
      log.debug('payment: notify ignored event type', {
        provider,
        eventType,
      });
    }

    return jsonOk({ message: 'success' });
  }
);
