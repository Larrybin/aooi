import 'server-only';

import { and, count, eq, lte, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { verification } from '@/config/db/schema';
import { normalizeEmail } from '@/shared/lib/email';
import { getUuid } from '@/shared/lib/hash';

const IDENTIFIER_PREFIX = 'auth-reset-password-throttle';
const RESET_PASSWORD_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RESET_PASSWORD_MAX_ATTEMPTS = 3;
const RESET_PASSWORD_MAX_CONCURRENT = 1;

function buildAttemptIdentifier(email: string): string {
  return `${IDENTIFIER_PREFIX}:attempt:${normalizeEmail(email)}`;
}

function buildInflightIdentifier(email: string): string {
  return `${IDENTIFIER_PREFIX}:inflight:${normalizeEmail(email)}`;
}

export type ConsumeResetPasswordQuotaResult =
  | {
      allowed: true;
      inflightId: string;
    }
  | {
      allowed: false;
      reason: 'rate_limited' | 'concurrency_limit';
    };

export async function consumeResetPasswordQuota(
  email: string
): Promise<ConsumeResetPasswordQuotaResult> {
  const normalized = normalizeEmail(email);
  const attemptIdentifier = buildAttemptIdentifier(normalized);
  const inflightIdentifier = buildInflightIdentifier(normalized);
  const now = new Date();
  const expiresAt = new Date(Date.now() + RESET_PASSWORD_WINDOW_MS);

  return db().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${IDENTIFIER_PREFIX}), hashtext(${normalized}))`
    );

    await tx
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, attemptIdentifier),
          lte(verification.expiresAt, now)
        )
      );

    await tx
      .delete(verification)
      .where(
        and(
          eq(verification.identifier, inflightIdentifier),
          lte(verification.expiresAt, now)
        )
      );

    const [attempts] = await tx
      .select({ count: count() })
      .from(verification)
      .where(eq(verification.identifier, attemptIdentifier));

    if ((attempts?.count || 0) >= RESET_PASSWORD_MAX_ATTEMPTS) {
      return { allowed: false, reason: 'rate_limited' };
    }

    const [inflight] = await tx
      .select({ count: count() })
      .from(verification)
      .where(eq(verification.identifier, inflightIdentifier));

    if ((inflight?.count || 0) >= RESET_PASSWORD_MAX_CONCURRENT) {
      return { allowed: false, reason: 'concurrency_limit' };
    }

    await tx.insert(verification).values({
      id: getUuid(),
      identifier: attemptIdentifier,
      value: '1',
      expiresAt,
    });

    const inflightId = getUuid();
    await tx.insert(verification).values({
      id: inflightId,
      identifier: inflightIdentifier,
      value: '1',
      expiresAt,
    });

    return { allowed: true, inflightId };
  });
}

export async function releaseResetPasswordQuota(inflightId: string) {
  if (!inflightId?.trim()) return;
  await db().delete(verification).where(eq(verification.id, inflightId));
}
