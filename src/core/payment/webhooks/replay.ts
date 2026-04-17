import {
  type PaymentNotifyDeps,
  type PaymentNotifyProcessResult,
} from '@/core/payment/webhooks/process-payment-notify';
import { type PaymentEvent } from '@/core/payment/domain';
import { type PaymentWebhookOperationKind } from '@/shared/models/payment_webhook_inbox.shared';

export type PaymentWebhookReplayRow = {
  id: string;
  provider: string;
  canonicalEvent: string | null;
};

export type PaymentWebhookReplayLog = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export type PaymentWebhookReplaySummary = {
  processed: number;
  failed: number;
  skipped: number;
};

export type PaymentWebhookReplayDeps = {
  replayDeps: PaymentNotifyDeps;
  createLog: (userId: string, operationKind: PaymentWebhookOperationKind) => PaymentWebhookReplayLog;
  markPaymentWebhookInboxAttempt: (input: {
    inboxId: string;
    operatorUserId?: string | null;
    operatorNote?: string | null;
  }) => Promise<unknown>;
  markPaymentWebhookInboxProcessFailed: (input: {
    inboxId: string;
    error: unknown;
  }) => Promise<unknown>;
  markPaymentWebhookInboxProcessed: (input: {
    inboxId: string;
    eventType: PaymentNotifyProcessResult['eventType'];
  }) => Promise<unknown>;
  deserializePaymentWebhookCanonicalEvent: (serializedEvent: string) => PaymentEvent;
  processPaymentNotifyEvent: (input: {
    provider: string;
    event: PaymentEvent;
    log: PaymentWebhookReplayLog;
    deps: PaymentNotifyDeps;
  }) => Promise<PaymentNotifyProcessResult>;
};

export async function runPaymentWebhookReplay(input: {
  rows: PaymentWebhookReplayRow[];
  userId: string;
  operationKind: PaymentWebhookOperationKind;
  note?: string;
  deps: PaymentWebhookReplayDeps;
}): Promise<PaymentWebhookReplaySummary> {
  const log = input.deps.createLog(input.userId, input.operationKind);
  const summary: PaymentWebhookReplaySummary = {
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const row of input.rows) {
    if (!row.canonicalEvent) {
      summary.skipped += 1;
      continue;
    }

    await input.deps.markPaymentWebhookInboxAttempt({
      inboxId: row.id,
      operatorUserId: input.userId,
      operatorNote: `${input.operationKind}: ${input.note?.trim() || 'no note'}`,
    });

    try {
      const event = input.deps.deserializePaymentWebhookCanonicalEvent(
        row.canonicalEvent
      );
      const result = await input.deps.processPaymentNotifyEvent({
        provider: row.provider,
        event,
        log,
        deps: input.deps.replayDeps,
      });

      await input.deps.markPaymentWebhookInboxProcessed({
        inboxId: row.id,
        eventType: result.eventType,
      });
      summary.processed += 1;
    } catch (error: unknown) {
      await input.deps.markPaymentWebhookInboxProcessFailed({
        inboxId: row.id,
        error,
      });
      summary.failed += 1;
    }
  }

  return summary;
}
