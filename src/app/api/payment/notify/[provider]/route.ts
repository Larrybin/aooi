import { createApiContext } from '@/shared/lib/api/context';
import { NotFoundError } from '@/shared/lib/api/errors';
import { withApi } from '@/shared/lib/api/route';
import { logger } from '@/shared/lib/logger.server';
import {
  createPaymentWebhookInboxReceipt,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessFailed,
  markPaymentWebhookInboxProcessed,
  recordPaymentWebhookInboxCanonicalEvent,
  serializePaymentWebhookHeaders,
} from '@/shared/models/payment_webhook_inbox';
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
  handlePaymentNotifyRequest,
  type PaymentNotifyFlowDeps,
} from './payment-notify-flow';
import type { PaymentNotifyDeps } from './process-payment-notify';

type PaymentNotifyRouteDeps = PaymentNotifyDeps & {
  getPaymentService: typeof getPaymentService;
  createPaymentWebhookInboxReceipt: typeof createPaymentWebhookInboxReceipt;
  recordPaymentWebhookInboxCanonicalEvent: typeof recordPaymentWebhookInboxCanonicalEvent;
  markPaymentWebhookInboxAttempt: typeof markPaymentWebhookInboxAttempt;
  markPaymentWebhookInboxProcessFailed: typeof markPaymentWebhookInboxProcessFailed;
  markPaymentWebhookInboxProcessed: typeof markPaymentWebhookInboxProcessed;
  serializePaymentWebhookHeaders: typeof serializePaymentWebhookHeaders;
  now: () => Date;
};

const paymentNotifyDeps: PaymentNotifyRouteDeps = {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
  findSubscriptionByProviderSubscriptionId,
  recordUnknownWebhookEvent: recordPaymentWebhookAudit,
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
  getPaymentService,
  createPaymentWebhookInboxReceipt,
  recordPaymentWebhookInboxCanonicalEvent,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessFailed,
  markPaymentWebhookInboxProcessed,
  serializePaymentWebhookHeaders,
  now: () => new Date(),
};

function buildPaymentNotifyPostLogic(
  overrides: Partial<PaymentNotifyRouteDeps> = {}
) {
  const deps = { ...paymentNotifyDeps, ...overrides };

  return async (
    req: Request,
    { params }: { params: Promise<{ provider: string }> }
  ) => {
    const api = createApiContext(req);
    const { log } = api;
    const { provider } = await api.parseParams(params, PaymentNotifyParamsSchema);

    const paymentService = await deps.getPaymentService();
    const paymentProvider = paymentService.getProvider(provider);
    if (!paymentProvider) {
      throw new NotFoundError('payment provider not found');
    }

    const flowDeps: PaymentNotifyFlowDeps = {
      ...deps,
      getPaymentEvent: (inputReq) => paymentProvider.getPaymentEvent({ req: inputReq }),
      onProcessFailure: ({ provider: failedProvider, inboxId, error }) => {
        logger.error('payment: webhook inbox process failed', {
          provider: failedProvider,
          inboxId,
          error,
        });
      },
    };

    return handlePaymentNotifyRequest({
      provider,
      req,
      log,
      deps: flowDeps,
    });
  };
}

export function createPaymentNotifyPostHandler(
  overrides: Partial<PaymentNotifyRouteDeps> = {}
) {
  return withApi(buildPaymentNotifyPostLogic(overrides));
}

export const POST = withApi(buildPaymentNotifyPostLogic());
