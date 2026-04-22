import { createApiContext } from '@/app/api/_lib/context';
import {
  readRuntimeSettingsCached,
  readRuntimeSettingsFresh,
} from '@/domains/settings/application/settings-runtime.query';
import { withApi } from '@/shared/lib/api/route';
import { resolveConfigConsistencyMode } from '@/shared/lib/config-consistency';
import {
  createPaymentWebhookInboxReceipt,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessFailed,
  markPaymentWebhookInboxProcessed,
  recordPaymentWebhookInboxCanonicalEvent,
  serializePaymentWebhookHeaders,
} from '@/domains/billing/infra/payment-webhook-inbox';
import {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
} from '@/domains/billing/infra/order';
import { recordPaymentWebhookAudit } from '@/domains/billing/infra/payment-webhook-audit';
import {
  findSubscriptionByProviderSubscriptionId,
} from '@/domains/billing/infra/subscription';
import { PaymentNotifyParamsSchema } from '@/shared/schemas/api/payment/notify';
import {
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/domains/billing/application/flows';
import {
  handlePaymentNotifyRequest,
  type PaymentNotifyFlowDeps,
} from '@/domains/billing/application/payment-notify-flow';
import type { PaymentNotifyDeps } from '@/domains/billing/application/process-payment-notify';
import { getPaymentServiceWithConfigs } from '@/infra/adapters/payment/service';

type PaymentNotifyRouteDeps = PaymentNotifyDeps & {
  createPaymentWebhookInboxReceipt: typeof createPaymentWebhookInboxReceipt;
  recordPaymentWebhookInboxCanonicalEvent: typeof recordPaymentWebhookInboxCanonicalEvent;
  markPaymentWebhookInboxAttempt: typeof markPaymentWebhookInboxAttempt;
  markPaymentWebhookInboxProcessFailed: typeof markPaymentWebhookInboxProcessFailed;
  markPaymentWebhookInboxProcessed: typeof markPaymentWebhookInboxProcessed;
  serializePaymentWebhookHeaders: typeof serializePaymentWebhookHeaders;
  readRuntimeSettingsCached: typeof readRuntimeSettingsCached;
  readRuntimeSettingsFresh: typeof readRuntimeSettingsFresh;
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
  createPaymentWebhookInboxReceipt,
  recordPaymentWebhookInboxCanonicalEvent,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessFailed,
  markPaymentWebhookInboxProcessed,
  serializePaymentWebhookHeaders,
  readRuntimeSettingsCached,
  readRuntimeSettingsFresh,
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
    const mode = resolveConfigConsistencyMode(req);
    const configs =
      mode === 'fresh'
        ? await deps.readRuntimeSettingsFresh()
        : await deps.readRuntimeSettingsCached();

    const paymentService = await getPaymentServiceWithConfigs(configs);

    const flowDeps: PaymentNotifyFlowDeps = {
      ...deps,
      getPaymentEvent: (inputReq) =>
        paymentService.getPaymentEvent({
          provider,
          req: inputReq,
        }),
      onProcessFailure: ({ provider: failedProvider, inboxId, error }) => {
        log.error('payment: webhook inbox process failed', {
          operation: 'process-webhook-inbox',
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
