import {
  PaymentEventType,
  SubscriptionCycleType,
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
} from '@/extensions/payment';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { parseParams } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { getRequestLogger } from '@/shared/lib/request-logger.server';
import { findOrderByOrderNo, OrderStatus } from '@/shared/models/order';
import { findSubscriptionByProviderSubscriptionId } from '@/shared/models/subscription';
import { PaymentNotifyParamsSchema } from '@/shared/schemas/api/payment/notify';
import {
  getPaymentService,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/shared/services/payment';

export const POST = withApi(
  async (
    req: Request,
    { params }: { params: Promise<{ provider: string }> }
  ) => {
    const { log } = getRequestLogger(req);
    const { provider } = await parseParams(params, PaymentNotifyParamsSchema);

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
        throw new UnauthorizedError(err.message);
      }
      if (err instanceof WebhookPayloadError) {
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
      const orderNo = (session.metadata as Record<string, unknown> | undefined)
        ?.order_no as string | undefined;

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
      });
    } else if (eventType === PaymentEventType.PAYMENT_SUCCESS) {
      // only handle subscription payment
      if (session.subscriptionId && session.subscriptionInfo) {
        if (
          session.paymentInfo?.subscriptionCycleType ===
          SubscriptionCycleType.RENEWAL
        ) {
          const existingSubscription =
            await findSubscriptionByProviderSubscriptionId({
              provider: provider,
              subscriptionId: session.subscriptionId,
            });
          if (!existingSubscription) {
            throw new NotFoundError('subscription not found');
          }

          await handleSubscriptionRenewal({
            subscription: existingSubscription,
            session,
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

      await handleSubscriptionUpdated({
        subscription: existingSubscription,
        session,
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

      await handleSubscriptionCanceled({
        subscription: existingSubscription,
        session,
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
