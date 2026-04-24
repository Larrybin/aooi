import {
  findOrderByInvoiceId,
  findOrderByOrderNo,
  findOrderByTransactionId,
} from '@/domains/billing/infra/order';
import { recordPaymentWebhookAudit } from '@/domains/billing/infra/payment-webhook-audit';
import { deserializePaymentWebhookCanonicalEvent } from '@/domains/billing/infra/payment-webhook-canonical-event';
import {
  findPaymentWebhookInboxByIds,
  getPaymentWebhookInboxPreview,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessed,
  markPaymentWebhookInboxProcessFailed,
} from '@/domains/billing/infra/payment-webhook-inbox';
import {
  PAYMENT_WEBHOOK_INBOX_STATUS,
  PAYMENT_WEBHOOK_OPERATION_KIND,
  type PaymentWebhookInboxStatus,
  type PaymentWebhookOperationKind,
} from '@/domains/billing/infra/payment-webhook-inbox.shared';
import { findSubscriptionByProviderSubscriptionId } from '@/domains/billing/infra/subscription';
import { createUseCaseLogger } from '@/infra/platform/logging/logger.server';
import { z } from 'zod';

import {
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from './flows';
import {
  processPaymentNotifyEvent,
  type PaymentNotifyDeps,
} from './process-payment-notify';
import {
  runPaymentWebhookReplay,
  type PaymentWebhookReplaySummary,
} from './replay';

export { PAYMENT_WEBHOOK_INBOX_STATUS, PAYMENT_WEBHOOK_OPERATION_KIND };

export type AdminPaymentReplayPreviewRow = Awaited<
  ReturnType<typeof getPaymentWebhookInboxPreview>
>[number];

export const PaymentReplayActionSchema = z.object({
  inboxIds: z.array(z.string().min(1)),
  operationKind: z.enum([
    PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY,
    PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION,
  ]),
  note: z.string().optional(),
  returnPath: z.string().optional(),
});

const replayDeps: PaymentNotifyDeps = {
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

const baseReplayLog = createUseCaseLogger({
  domain: 'billing',
  useCase: 'payment-webhook-replay',
});

function createReplayLog(userId: string, operationKind: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      baseReplayLog.debug(message, {
        operation: 'replay-webhook-events',
        ...meta,
        operatorUserId: userId,
        operationKind,
      });
    },
    info(message: string, meta?: Record<string, unknown>) {
      baseReplayLog.info(message, {
        operation: 'replay-webhook-events',
        ...meta,
        operatorUserId: userId,
        operationKind,
      });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      baseReplayLog.warn(message, {
        operation: 'replay-webhook-events',
        ...meta,
        operatorUserId: userId,
        operationKind,
      });
    },
    error(message: string, meta?: Record<string, unknown>) {
      baseReplayLog.error(message, {
        operation: 'replay-webhook-events',
        ...meta,
        operatorUserId: userId,
        operationKind,
      });
    },
  };
}

export function parsePaymentReplayDateTime(
  value: string | undefined
): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildPaymentReplayReturnPath(
  params: Record<string, string | undefined>
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value?.trim()) {
      continue;
    }
    search.set(key, value);
  }

  return `/admin/payments/replay${search.size > 0 ? `?${search.toString()}` : ''}`;
}

export function getPaymentReplayPreviewLabel(row: {
  canonicalEvent: string | null;
  status: string;
}) {
  if (!row.canonicalEvent) {
    return 'unsupported_legacy';
  }
  if (row.status === PAYMENT_WEBHOOK_INBOX_STATUS.PROCESS_FAILED) {
    return 'retry_failed';
  }
  if (row.status === PAYMENT_WEBHOOK_INBOX_STATUS.PARSE_FAILED) {
    return 'parse_failed';
  }
  return 'will_process';
}

export async function listAdminPaymentReplayPreview(input: {
  provider?: string;
  eventId?: string;
  status?: PaymentWebhookInboxStatus | 'all';
  receivedFrom?: Date | null;
  receivedTo?: Date | null;
}) {
  return getPaymentWebhookInboxPreview(input);
}

function buildReplayExecuteRedirectPath(
  returnPath: string | undefined,
  summary: { processed: number; failed: number; skipped: number }
) {
  const basePath = returnPath?.trim() || '/admin/payments/replay?preview=1';
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}executed=1&processed=${summary.processed}&failed=${summary.failed}&skipped=${summary.skipped}`;
}

export async function executeAdminPaymentReplay(input: {
  inboxIds: string[];
  operationKind: PaymentWebhookOperationKind;
  note?: string;
  returnPath?: string;
  actorUserId: string;
}) {
  const rows = await findPaymentWebhookInboxByIds(input.inboxIds);
  if (rows.length === 0) {
    return { status: 'not_found' as const };
  }

  const summary: PaymentWebhookReplaySummary = await runPaymentWebhookReplay({
    rows,
    userId: input.actorUserId,
    operationKind: input.operationKind,
    note: input.note,
    deps: {
      replayDeps,
      createLog: createReplayLog,
      markPaymentWebhookInboxAttempt,
      markPaymentWebhookInboxProcessFailed,
      markPaymentWebhookInboxProcessed,
      deserializePaymentWebhookCanonicalEvent,
      processPaymentNotifyEvent,
    },
  });

  return {
    status: 'ok' as const,
    summary,
    redirectUrl: buildReplayExecuteRedirectPath(input.returnPath, summary),
  };
}
