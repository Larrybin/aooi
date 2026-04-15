import {
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentEvent,
} from '@/extensions/payment';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
} from '@/shared/models/order';
import { recordPaymentWebhookAudit } from '@/shared/models/payment_webhook_audit';
import {
  findSubscriptionByProviderSubscriptionId,
} from '@/shared/models/subscription';
import { PaymentNotifyParamsSchema } from '@/shared/schemas/api/payment/notify';
import {
  getPaymentService,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/shared/services/payment';
import {
  processPaymentNotifyEvent,
  type PaymentNotifyDeps,
} from './process-payment-notify';

async function getPaymentEventOrThrow({
  provider,
  paymentProvider,
  req,
  log,
}: {
  provider: string;
  paymentProvider: {
    getPaymentEvent(args: { req: Request }): Promise<PaymentEvent>;
  };
  req: Request;
  log: ReturnType<typeof createApiContext>['log'];
}): Promise<PaymentEvent> {
  try {
    return await paymentProvider.getPaymentEvent({ req });
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
}

const paymentNotifyDeps: PaymentNotifyDeps = {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
  findSubscriptionByProviderSubscriptionId,
  recordUnknownWebhookEvent: recordPaymentWebhookAudit,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
};

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

    const event = await getPaymentEventOrThrow({
      provider,
      paymentProvider,
      req,
      log,
    });
    if (!event) throw new BadRequestError('payment event not found');
    return processPaymentNotifyEvent({
      provider,
      event,
      log,
      deps: paymentNotifyDeps,
    });
  }
);
