import 'server-only';

import { createHash } from 'crypto';
import {
  PaymentEventType,
  type PaymentEvent,
} from '@/domains/billing/domain/payment';
import { serializePaymentWebhookCanonicalEvent } from '@/domains/billing/infra/payment-webhook-canonical-event';
import {
  PAYMENT_WEBHOOK_INBOX_STATUS,
  PAYMENT_WEBHOOK_OPERATION_KIND,
  type PaymentWebhookInboxStatus,
  type PaymentWebhookOperationKind,
} from '@/domains/billing/infra/payment-webhook-inbox.shared';
import { db } from '@/infra/adapters/db';
import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';

import { paymentWebhookInbox } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

export { PAYMENT_WEBHOOK_INBOX_STATUS, PAYMENT_WEBHOOK_OPERATION_KIND };
export type { PaymentWebhookInboxStatus, PaymentWebhookOperationKind };

export type PaymentWebhookInboxRecord = typeof paymentWebhookInbox.$inferSelect;

/**
 * Marks a row as claimed by an in-flight processing attempt. It is deliberately
 * not a finalized status: an attempt that crashes hard leaves the row behind,
 * and the claim has to become reclaimable again instead of stranding the event.
 */
export const PAYMENT_WEBHOOK_INBOX_PROCESSING_STATUS = 'processing';

/**
 * Statuses a redelivery may take over: anything that is neither finalized nor
 * currently claimed. `received` only shows up on rows written before the claim
 * existed, but it stays claimable so those rows can still be retried.
 */
const CLAIMABLE_PAYMENT_WEBHOOK_INBOX_STATUSES: string[] = [
  PAYMENT_WEBHOOK_INBOX_STATUS.RECEIVED,
  PAYMENT_WEBHOOK_INBOX_STATUS.PARSE_FAILED,
  PAYMENT_WEBHOOK_INBOX_STATUS.PROCESS_FAILED,
];

/**
 * A claim older than this is assumed to belong to an attempt that died without
 * writing a terminal status. Webhook processing finishes in seconds, so the
 * window only has to outlast the request itself.
 */
const PAYMENT_WEBHOOK_INBOX_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

function normalizeOptionalText(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function extractEventId(event: PaymentEvent): string | null {
  const paymentSession = event.paymentSession;
  const metadata = paymentSession.metadata || {};
  const eventResult =
    event.eventResult && typeof event.eventResult === 'object'
      ? (event.eventResult as Record<string, unknown>)
      : {};

  return (
    normalizeOptionalText(metadata.event_id as string | undefined) ||
    normalizeOptionalText(metadata.eventId as string | undefined) ||
    normalizeOptionalText(metadata.id as string | undefined) ||
    normalizeOptionalText(eventResult.event_id as string | undefined) ||
    normalizeOptionalText(eventResult.eventId as string | undefined) ||
    normalizeOptionalText(eventResult.id as string | undefined)
  );
}

function extractEventType(event: PaymentEvent): string | null {
  const paymentSession = event.paymentSession;
  const metadata = paymentSession.metadata || {};

  return (
    normalizeOptionalText(metadata.event_type as string | undefined) ||
    normalizeOptionalText(metadata.eventType as string | undefined) ||
    normalizeOptionalText(event.eventType)
  );
}

export function buildPaymentWebhookRawDigest(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

export function serializePaymentWebhookHeaders(headers: Headers): string {
  return JSON.stringify(Object.fromEntries(headers.entries()));
}

/**
 * Records the payload and claims it for processing in one step.
 *
 * The unique (provider, rawDigest) row is the mutex: writing it, or winning the
 * conditional update below, is what grants the caller the right to process the
 * payload. A provider that redelivers after a response timeout would otherwise
 * find the first attempt still in `received` and run a second handler pass
 * concurrently, because merely having a row says nothing about who owns it.
 */
export async function createPaymentWebhookInboxReceipt(input: {
  provider: string;
  rawBody: string;
  rawHeaders: string;
  source: string;
  receivedAt: Date;
}) {
  const rawDigest = buildPaymentWebhookRawDigest(input.rawBody);
  const [inserted] = await db()
    .insert(paymentWebhookInbox)
    .values({
      id: getUuid(),
      provider: input.provider,
      rawBody: input.rawBody,
      rawHeaders: input.rawHeaders,
      rawDigest,
      status: PAYMENT_WEBHOOK_INBOX_PROCESSING_STATUS,
      source: input.source,
      receivedAt: input.receivedAt,
    })
    .onConflictDoNothing({
      target: [paymentWebhookInbox.provider, paymentWebhookInbox.rawDigest],
    })
    .returning();

  if (inserted) {
    return { record: inserted, isNew: true, alreadyClaimed: false };
  }

  const staleClaimBefore = new Date(
    Date.now() - PAYMENT_WEBHOOK_INBOX_CLAIM_TIMEOUT_MS
  );
  const [claimed] = await db()
    .update(paymentWebhookInbox)
    .set({
      status: PAYMENT_WEBHOOK_INBOX_PROCESSING_STATUS,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymentWebhookInbox.provider, input.provider),
        eq(paymentWebhookInbox.rawDigest, rawDigest),
        or(
          inArray(
            paymentWebhookInbox.status,
            CLAIMABLE_PAYMENT_WEBHOOK_INBOX_STATUSES
          ),
          and(
            eq(
              paymentWebhookInbox.status,
              PAYMENT_WEBHOOK_INBOX_PROCESSING_STATUS
            ),
            lt(paymentWebhookInbox.updatedAt, staleClaimBefore)
          )
        )
      )
    )
    .returning();

  if (claimed) {
    return { record: claimed, isNew: false, alreadyClaimed: false };
  }

  // No row matched: the payload is either finalized or owned by a live attempt.
  // Read it back so the caller can tell those two cases apart in its response.
  const [existing] = await db()
    .select()
    .from(paymentWebhookInbox)
    .where(
      and(
        eq(paymentWebhookInbox.provider, input.provider),
        eq(paymentWebhookInbox.rawDigest, rawDigest)
      )
    );

  if (!existing) {
    throw new Error('payment webhook inbox receipt upsert failed');
  }

  return { record: existing, isNew: false, alreadyClaimed: true };
}

export async function recordPaymentWebhookInboxCanonicalEvent(input: {
  inboxId: string;
  event: PaymentEvent;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      eventId: extractEventId(input.event),
      eventType: extractEventType(input.event),
      canonicalEvent: serializePaymentWebhookCanonicalEvent(input.event),
      lastError: null,
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxAttempt(input: {
  inboxId: string;
  operatorUserId?: string | null;
  operatorNote?: string | null;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      operatorUserId: normalizeOptionalText(input.operatorUserId),
      operatorNote: normalizeOptionalText(input.operatorNote),
      processingAttemptCount: sql`${paymentWebhookInbox.processingAttemptCount} + 1`,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxParseFailed(input: {
  inboxId: string;
  error: unknown;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      status: PAYMENT_WEBHOOK_INBOX_STATUS.PARSE_FAILED,
      lastError: String(input.error),
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxProcessFailed(input: {
  inboxId: string;
  error: unknown;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      status: PAYMENT_WEBHOOK_INBOX_STATUS.PROCESS_FAILED,
      lastError: String(input.error),
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

export async function markPaymentWebhookInboxProcessed(input: {
  inboxId: string;
  eventType: PaymentEventType;
}) {
  const [updated] = await db()
    .update(paymentWebhookInbox)
    .set({
      status:
        input.eventType === PaymentEventType.UNKNOWN
          ? PAYMENT_WEBHOOK_INBOX_STATUS.IGNORED_UNKNOWN
          : PAYMENT_WEBHOOK_INBOX_STATUS.PROCESSED,
      lastProcessedAt: new Date(),
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(paymentWebhookInbox.id, input.inboxId))
    .returning();

  return updated;
}

/**
 * Feeds the replay executor, which applies rows in the order it receives them.
 * Ordering is ascending — unlike the preview list below — because replaying a
 * selection newest-first would leave the aggregate (order, subscription) in the
 * state of the *oldest* event, e.g. an active subscription flipped back to
 * paused by replaying `paused` after `active`.
 */
export async function findPaymentWebhookInboxByIds(ids: string[]) {
  const normalizedIds = [
    ...new Set(ids.map((id) => id.trim()).filter(Boolean)),
  ];
  if (normalizedIds.length === 0) {
    return [] as PaymentWebhookInboxRecord[];
  }

  return db()
    .select()
    .from(paymentWebhookInbox)
    .where(inArray(paymentWebhookInbox.id, normalizedIds))
    .orderBy(asc(paymentWebhookInbox.receivedAt));
}

/**
 * Read-only admin listing, ordered newest-first because that is what an operator
 * scanning recent webhook traffic expects. The execution path deliberately uses
 * the opposite order (see findPaymentWebhookInboxByIds).
 */
export async function getPaymentWebhookInboxPreview(input: {
  provider?: string;
  eventId?: string;
  status?: PaymentWebhookInboxStatus | 'all';
  receivedFrom?: Date | null;
  receivedTo?: Date | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(input.limit ?? 50, 200));

  return db()
    .select()
    .from(paymentWebhookInbox)
    .where(
      and(
        input.provider
          ? eq(paymentWebhookInbox.provider, input.provider.trim())
          : undefined,
        input.eventId
          ? eq(paymentWebhookInbox.eventId, input.eventId.trim())
          : undefined,
        input.status && input.status !== 'all'
          ? eq(paymentWebhookInbox.status, input.status)
          : undefined,
        input.receivedFrom
          ? gte(paymentWebhookInbox.receivedAt, input.receivedFrom)
          : undefined,
        input.receivedTo
          ? lte(paymentWebhookInbox.receivedAt, input.receivedTo)
          : undefined
      )
    )
    .orderBy(desc(paymentWebhookInbox.receivedAt))
    .limit(limit);
}
