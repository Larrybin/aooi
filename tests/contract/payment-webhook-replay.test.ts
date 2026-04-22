import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PaymentEventType,
  type PaymentEvent,
} from '@/domains/billing/domain/payment';
import {
  runPaymentWebhookReplay,
  type PaymentWebhookReplayRow,
} from '@/domains/billing/application/replay';
import { PAYMENT_WEBHOOK_OPERATION_KIND } from '@/domains/billing/infra/payment-webhook-inbox.shared';

function createInboxRow(overrides: Partial<PaymentWebhookReplayRow> = {}): PaymentWebhookReplayRow {
  return {
    id: 'inbox_1',
    provider: 'creem',
    canonicalEvent: '{"eventType":"checkout.success"}',
    ...overrides,
  };
}

test('runPaymentWebhookReplay 对 canonical event 执行 replay 并写回 processed', async () => {
  const attempts: Array<{ inboxId: string; operatorNote?: string | null }> = [];
  const processed: Array<{ inboxId: string; eventType: PaymentEventType }> = [];
  const event: PaymentEvent = {
    eventType: PaymentEventType.CHECKOUT_SUCCESS,
    eventResult: {},
    paymentSession: {
      provider: 'creem',
      metadata: {
        order_no: 'order_1',
      },
    },
  };

  const summary = await runPaymentWebhookReplay({
    rows: [createInboxRow()],
    userId: 'user_1',
    operationKind: PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY,
    note: 'retry failed webhook',
    deps: {
      replayDeps: createReplayDeps(),
      createLog: () => createLog(),
      markPaymentWebhookInboxAttempt: async ({ inboxId, operatorNote }) => {
        attempts.push({ inboxId, operatorNote });
        return createInboxRow({ id: inboxId });
      },
      deserializePaymentWebhookCanonicalEvent: () => event,
      processPaymentNotifyEvent: async () => ({
        response: Response.json({ ok: true }),
        outcome: 'processed',
        eventType: PaymentEventType.CHECKOUT_SUCCESS,
      }),
      markPaymentWebhookInboxProcessed: async ({ inboxId, eventType }) => {
        processed.push({ inboxId, eventType });
        return createInboxRow({
          id: inboxId,
          status: 'processed',
          eventType,
        });
      },
      markPaymentWebhookInboxProcessFailed: async () => {
        throw new Error('should not mark failed');
      },
    },
  });

  assert.deepEqual(summary, {
    processed: 1,
    failed: 0,
    skipped: 0,
  });
  assert.deepEqual(attempts, [
    {
      inboxId: 'inbox_1',
      operatorNote: 'replay: retry failed webhook',
    },
  ]);
  assert.deepEqual(processed, [
    {
      inboxId: 'inbox_1',
      eventType: PaymentEventType.CHECKOUT_SUCCESS,
    },
  ]);
});

test('runPaymentWebhookReplay 对缺失 canonical event 的行直接跳过', async () => {
  let attempted = false;

  const summary = await runPaymentWebhookReplay({
    rows: [createInboxRow({ id: 'legacy_1', canonicalEvent: null })],
    userId: 'user_1',
    operationKind: PAYMENT_WEBHOOK_OPERATION_KIND.COMPENSATION,
    deps: {
      replayDeps: createReplayDeps(),
      createLog: () => createLog(),
      markPaymentWebhookInboxAttempt: async () => {
        attempted = true;
        return createInboxRow();
      },
    },
  });

  assert.deepEqual(summary, {
    processed: 0,
    failed: 0,
    skipped: 1,
  });
  assert.equal(attempted, false);
});

test('runPaymentWebhookReplay 在处理失败时标记 failed', async () => {
  const failures: Array<{ inboxId: string; error: string }> = [];

  const summary = await runPaymentWebhookReplay({
    rows: [createInboxRow()],
    userId: 'user_1',
    operationKind: PAYMENT_WEBHOOK_OPERATION_KIND.REPLAY,
    deps: {
      replayDeps: createReplayDeps(),
      createLog: () => createLog(),
      markPaymentWebhookInboxAttempt: async ({ inboxId }) => createInboxRow({ id: inboxId }),
      deserializePaymentWebhookCanonicalEvent: () => ({
        eventType: PaymentEventType.UNKNOWN,
        eventResult: {},
        paymentSession: {
          provider: 'creem',
        },
      }),
      processPaymentNotifyEvent: async () => {
        throw new Error('processor exploded');
      },
      markPaymentWebhookInboxProcessFailed: async ({ inboxId, error }) => {
        failures.push({ inboxId, error: String(error) });
        return createInboxRow({
          id: inboxId,
          status: 'process_failed',
          lastError: String(error),
        });
      },
    },
  });

  assert.deepEqual(summary, {
    processed: 0,
    failed: 1,
    skipped: 0,
  });
  assert.deepEqual(failures, [
    {
      inboxId: 'inbox_1',
      error: 'Error: processor exploded',
    },
  ]);
});

function createReplayDeps() {
  return {
    findOrderByInvoiceId: async () => null,
    findOrderByOrderNo: async () => null,
    findOrderByTransactionId: async () => null,
    findSubscriptionByProviderSubscriptionId: async () => null,
    recordUnknownWebhookEvent: async () => undefined,
    handleCheckoutSuccess: async () => undefined,
    handleSubscriptionCanceled: async () => undefined,
    handleSubscriptionRenewal: async () => undefined,
    handleSubscriptionUpdated: async () => undefined,
  };
}

function createLog() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}
