import 'server-only';

import { createHash, timingSafeEqual } from 'crypto';
import { and, desc, eq, ne } from 'drizzle-orm';

import { db } from '@/core/db';
import { verification } from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { normalizeEmail } from '@/shared/lib/email';
import { getUuid } from '@/shared/lib/hash';

export const SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;

const IDENTIFIER_PREFIX = 'settings-email-verify';

function buildIdentifier(input: { userId: string; email: string }): string {
  return `${IDENTIFIER_PREFIX}:${input.userId}:${normalizeEmail(input.email)}`;
}

function hashCode(input: { identifier: string; code: string }): string {
  return createHash('sha256')
    .update(`${input.identifier}:${serverEnv.authSecret}:${input.code}`)
    .digest('hex');
}

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export type PersistedEmailVerificationCode = {
  id: string;
  identifier: string;
  expiresAt: Date;
};

export async function persistSettingsEmailVerificationCode(input: {
  userId: string;
  email: string;
  code: string;
  ttlMs?: number;
}): Promise<PersistedEmailVerificationCode> {
  const identifier = buildIdentifier({
    userId: input.userId,
    email: input.email,
  });
  const id = getUuid();
  const expiresAt = new Date(
    Date.now() +
      (typeof input.ttlMs === 'number'
        ? input.ttlMs
        : SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS)
  );
  const value = hashCode({ identifier, code: input.code });

  await db().insert(verification).values({
    id,
    identifier,
    value,
    expiresAt,
  });

  return { id, identifier, expiresAt };
}

export async function deleteEmailVerificationCodeById(
  id: string
): Promise<void> {
  await db().delete(verification).where(eq(verification.id, id));
}

export async function deleteEmailVerificationCodesByIdentifierExceptId(input: {
  identifier: string;
  keepId: string;
}): Promise<void> {
  await db()
    .delete(verification)
    .where(
      and(
        eq(verification.identifier, input.identifier),
        ne(verification.id, input.keepId)
      )
    );
}

export type ConsumeEmailVerificationCodeResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'expired' | 'mismatch' };

export async function consumeSettingsEmailVerificationCode(input: {
  userId: string;
  email: string;
  code: string;
}): Promise<ConsumeEmailVerificationCodeResult> {
  const identifier = buildIdentifier({
    userId: input.userId,
    email: input.email,
  });

  const [record] = await db()
    .select()
    .from(verification)
    .where(eq(verification.identifier, identifier))
    .orderBy(desc(verification.createdAt))
    .limit(1);

  if (!record) {
    return { ok: false, reason: 'not_found' };
  }

  const now = new Date();
  if (record.expiresAt <= now) {
    await deleteEmailVerificationCodeById(record.id);
    return { ok: false, reason: 'expired' };
  }

  const expectedValue = hashCode({ identifier, code: input.code });
  const matches = timingSafeEqualHex(record.value, expectedValue);
  if (!matches) {
    return { ok: false, reason: 'mismatch' };
  }

  const [deleted] = await db()
    .delete(verification)
    .where(eq(verification.id, record.id))
    .returning();

  if (!deleted) {
    return { ok: false, reason: 'not_found' };
  }

  return { ok: true };
}
