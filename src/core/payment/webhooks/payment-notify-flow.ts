import {
  WebhookConfigError,
  WebhookPayloadError,
  WebhookVerificationError,
  type PaymentEvent,
} from '@/core/payment/domain';
import {
  BadRequestError,
  PayloadTooLargeError,
  UnauthorizedError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { readRequestTextWithLimit } from '@/shared/lib/runtime/request-body';
import { PAYMENT_WEBHOOK_INBOX_STATUS } from '@/shared/models/payment_webhook_inbox.shared';

import {
  processPaymentNotifyEvent,
  type PaymentNotifyDeps,
  type PaymentNotifyProcessResult,
} from './process-payment-notify';

export type PaymentNotifyFlowLog = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
};

export type PaymentWebhookInboxReceiptRecord = {
  id: string;
  status: string;
};

export type PaymentNotifyFlowDeps = PaymentNotifyDeps & {
  createPaymentWebhookInboxReceipt: (input: {
    provider: string;
    rawBody: string;
    rawHeaders: string;
    source: string;
    receivedAt: Date;
  }) => Promise<{
    record: PaymentWebhookInboxReceiptRecord;
    isNew: boolean;
  }>;
  recordPaymentWebhookInboxCanonicalEvent: (input: {
    inboxId: string;
    event: PaymentEvent;
  }) => Promise<unknown>;
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
  serializePaymentWebhookHeaders: (headers: Headers) => string;
  getPaymentEvent: (req: Request) => Promise<PaymentEvent>;
  now: () => Date;
  onProcessFailure?: (input: {
    provider: string;
    inboxId: string;
    error: unknown;
  }) => void | Promise<void>;
};

const MAX_PAYMENT_WEBHOOK_BODY_BYTES = 256 * 1024;

function isFinalizedInboxStatus(status: string): boolean {
  return (
    status === PAYMENT_WEBHOOK_INBOX_STATUS.PROCESSED ||
    status === PAYMENT_WEBHOOK_INBOX_STATUS.IGNORED_UNKNOWN
  );
}

export function createPaymentWebhookRequest(req: Request, rawBody: string): Request {
  return new Request(req.url, {
    method: req.method,
    headers: new Headers(req.headers),
    body: rawBody,
  });
}

function parseContentLengthHeader(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;

  return parsed;
}

async function readPaymentWebhookBodyOrThrow(req: Request): Promise<string> {
  const contentLength = parseContentLengthHeader(req.headers.get('content-length'));
  if (
    contentLength !== null &&
    contentLength > MAX_PAYMENT_WEBHOOK_BODY_BYTES
  ) {
    throw new PayloadTooLargeError('payload too large');
  }

  return readRequestTextWithLimit(req, MAX_PAYMENT_WEBHOOK_BODY_BYTES);
}

export async function getPaymentEventOrThrow(input: {
  provider: string;
  req: Request;
  log: PaymentNotifyFlowLog;
  getPaymentEvent: (req: Request) => Promise<PaymentEvent>;
}): Promise<PaymentEvent> {
  try {
    return await input.getPaymentEvent(input.req);
  } catch (err: unknown) {
    if (err instanceof WebhookVerificationError) {
      input.log.warn('payment: webhook verification failed', {
        provider: input.provider,
        eventType: 'unknown',
      });
      throw new UnauthorizedError(err.message);
    }
    if (err instanceof WebhookPayloadError) {
      input.log.warn('payment: webhook payload invalid', {
        provider: input.provider,
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

export async function handlePaymentNotifyRequest(input: {
  provider: string;
  req: Request;
  log: PaymentNotifyFlowLog;
  deps: PaymentNotifyFlowDeps;
}): Promise<Response> {
  const rawBody = await readPaymentWebhookBodyOrThrow(input.req);
  const requestForVerification = createPaymentWebhookRequest(input.req, rawBody);
  const receiptInput = {
    provider: input.provider,
    rawBody,
    rawHeaders: input.deps.serializePaymentWebhookHeaders(input.req.headers),
    source: 'live_webhook',
    receivedAt: input.deps.now(),
  };

  let event: PaymentEvent;
  try {
    event = await getPaymentEventOrThrow({
      provider: input.provider,
      req: requestForVerification,
      log: input.log,
      getPaymentEvent: input.deps.getPaymentEvent,
    });
  } catch (error: unknown) {
    if (
      error instanceof BadRequestError ||
      error instanceof UnauthorizedError ||
      error instanceof WebhookConfigError
    ) {
      throw error;
    }

    const inboxReceipt = await input.deps.createPaymentWebhookInboxReceipt(
      receiptInput
    );
    if (isFinalizedInboxStatus(inboxReceipt.record.status)) {
      input.log.debug('payment: webhook inbox deduped finalized payload', {
        provider: input.provider,
        inboxId: inboxReceipt.record.id,
        status: inboxReceipt.record.status,
      });
      return jsonOk({ message: 'already processed' });
    }
    await input.deps.markPaymentWebhookInboxAttempt({
      inboxId: inboxReceipt.record.id,
    });
    await input.deps.markPaymentWebhookInboxProcessFailed({
      inboxId: inboxReceipt.record.id,
      error,
    });
    await input.deps.onProcessFailure?.({
      provider: input.provider,
      inboxId: inboxReceipt.record.id,
      error,
    });
    throw error;
  }

  const inboxReceipt = await input.deps.createPaymentWebhookInboxReceipt(
    receiptInput
  );

  if (isFinalizedInboxStatus(inboxReceipt.record.status)) {
    input.log.debug('payment: webhook inbox deduped finalized payload', {
      provider: input.provider,
      inboxId: inboxReceipt.record.id,
      status: inboxReceipt.record.status,
    });
    return jsonOk({ message: 'already processed' });
  }

  await input.deps.markPaymentWebhookInboxAttempt({
    inboxId: inboxReceipt.record.id,
  });

  await input.deps.recordPaymentWebhookInboxCanonicalEvent({
    inboxId: inboxReceipt.record.id,
    event,
  });

  try {
    const result = await processPaymentNotifyEvent({
      provider: input.provider,
      event,
      log: input.log,
      deps: input.deps,
    });

    await input.deps.markPaymentWebhookInboxProcessed({
      inboxId: inboxReceipt.record.id,
      eventType: result.eventType,
    });

    return result.response;
  } catch (error: unknown) {
    await input.deps.markPaymentWebhookInboxProcessFailed({
      inboxId: inboxReceipt.record.id,
      error,
    });
    await input.deps.onProcessFailure?.({
      provider: input.provider,
      inboxId: inboxReceipt.record.id,
      error,
    });
    throw error;
  }
}
