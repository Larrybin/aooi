'use server';

import { z } from 'zod';

import { findOrderByInvoiceId, findOrderByOrderNo, findOrderByTransactionId } from '@/shared/models/order';
import {
  findPaymentWebhookInboxByIds,
  markPaymentWebhookInboxAttempt,
  markPaymentWebhookInboxProcessFailed,
  markPaymentWebhookInboxProcessed,
} from '@/shared/models/payment_webhook_inbox';
import { deserializePaymentWebhookCanonicalEvent } from '@/shared/models/payment_webhook_canonical_event';
import { PAYMENT_WEBHOOK_OPERATION_KIND } from '@/shared/models/payment_webhook_inbox.shared';
import { recordPaymentWebhookAudit } from '@/shared/models/payment_webhook_audit';
import { findSubscriptionByProviderSubscriptionId } from '@/shared/models/subscription';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { ActionError } from '@/shared/lib/action/errors';
import { jsonStringArraySchema, parseFormData } from '@/shared/lib/action/form';
import { actionOk } from '@/shared/lib/action/result';
import { withAction } from '@/shared/lib/action/with-action';
import { logger } from '@/shared/lib/logger.server';
import {
  handleCheckoutSuccess,
  handleSubscriptionCanceled,
  handleSubscriptionRenewal,
  handleSubscriptionUpdated,
} from '@/core/payment/flows/flows';
import type { PaymentNotifyDeps } from '@/core/payment/webhooks/process-payment-notify';
import { processPaymentNotifyEvent } from '@/core/payment/webhooks/process-payment-notify';
import {
  runPaymentWebhookReplay,
  type PaymentWebhookReplaySummary,
} from '@/core/payment/webhooks/replay';
import { requireActionPermission, requireActionUser } from '@/shared/lib/action/guard';

const ReplayActionSchema = z.object({
  inboxIds: jsonStringArraySchema,
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

function createReplayLog(userId: string, operationKind: string) {
  return {
    debug(message: string, meta?: Record<string, unknown>) {
      logger.debug(message, { ...meta, operatorUserId: userId, operationKind });
    },
    info(message: string, meta?: Record<string, unknown>) {
      logger.info(message, { ...meta, operatorUserId: userId, operationKind });
    },
    warn(message: string, meta?: Record<string, unknown>) {
      logger.warn(message, { ...meta, operatorUserId: userId, operationKind });
    },
    error(message: string, meta?: Record<string, unknown>) {
      logger.error(message, { ...meta, operatorUserId: userId, operationKind });
    },
  };
}

function buildReturnPath(
  returnPath: string | undefined,
  summary: { processed: number; failed: number; skipped: number }
) {
  const basePath =
    returnPath?.trim() || '/admin/payments/replay?preview=1';
  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}executed=1&processed=${summary.processed}&failed=${summary.failed}&skipped=${summary.skipped}`;
}

export async function executePaymentWebhookReplayAction(formData: FormData) {
  return withAction(async () => {
    const user = await requireActionUser();
    await requireActionPermission(user.id, PERMISSIONS.PAYMENTS_WRITE);

    const data = parseFormData(formData, ReplayActionSchema, {
      message: 'invalid replay payload',
    });

    const rows = await findPaymentWebhookInboxByIds(data.inboxIds);
    if (rows.length === 0) {
      throw new ActionError('No webhook inbox records selected');
    }

    const summary: PaymentWebhookReplaySummary = await runPaymentWebhookReplay({
      rows,
      userId: user.id,
      operationKind: data.operationKind,
      note: data.note,
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

    return actionOk(
      `replay finished: ${summary.processed} processed, ${summary.failed} failed, ${summary.skipped} skipped`,
      buildReturnPath(data.returnPath, summary)
    );
  });
}
