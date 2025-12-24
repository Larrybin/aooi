import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { createApiContext } from '@/shared/lib/api/context';
import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { maskEmail, normalizeEmail } from '@/shared/lib/email';
import {
  SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS,
  consumeSettingsEmailVerificationCode,
} from '@/shared/models/email_verification_code';
import { EmailVerifyCodeBodySchema } from '@/shared/schemas/api/email/verify-code';

const VERIFY_FAIL_WINDOW_MS = SETTINGS_EMAIL_VERIFICATION_CODE_TTL_MS;
const VERIFY_FAIL_MAX_ATTEMPTS = 5;
const VERIFY_FAIL_MAX_ENTRIES = 10_000;
let verifyFailCleanupTick = 0;

const failedAttemptsByIdentifier = new Map<
  string,
  { count: number; firstAt: number }
>();

function buildVerifyIdentifier(userId: string, email: string): string {
  return `${userId}|${normalizeEmail(email)}`;
}

function cleanupFailedAttempts(now: number): void {
  for (const [key, entry] of failedAttemptsByIdentifier.entries()) {
    if (now - entry.firstAt > VERIFY_FAIL_WINDOW_MS) {
      failedAttemptsByIdentifier.delete(key);
    }
  }

  const overflow = failedAttemptsByIdentifier.size - VERIFY_FAIL_MAX_ENTRIES;
  if (overflow <= 0) return;

  let removed = 0;
  for (const key of failedAttemptsByIdentifier.keys()) {
    failedAttemptsByIdentifier.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function recordFailedAttempt(key: string, now: number): number {
  const current = failedAttemptsByIdentifier.get(key);
  if (!current) {
    failedAttemptsByIdentifier.set(key, { count: 1, firstAt: now });
    return 1;
  }
  const withinWindow = now - current.firstAt <= VERIFY_FAIL_WINDOW_MS;
  if (!withinWindow) {
    failedAttemptsByIdentifier.set(key, { count: 1, firstAt: now });
    return 1;
  }
  const next = { count: current.count + 1, firstAt: current.firstAt };
  failedAttemptsByIdentifier.set(key, next);
  return next.count;
}

function remainingRetryAfterSeconds(entry: { firstAt: number }, now: number) {
  return Math.max(
    1,
    Math.ceil((VERIFY_FAIL_WINDOW_MS - (now - entry.firstAt)) / 1000)
  );
}

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const user = await api.requireUser();
  await api.requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);

  const { email, code } = await api.parseJson(EmailVerifyCodeBodySchema);
  const now = Date.now();

  if ((verifyFailCleanupTick++ & 0xff) === 0) {
    cleanupFailedAttempts(now);
  }

  const verifyKey = buildVerifyIdentifier(user.id, email);
  const existing = failedAttemptsByIdentifier.get(verifyKey);
  if (existing && existing.count >= VERIFY_FAIL_MAX_ATTEMPTS) {
    const retryAfterSeconds = remainingRetryAfterSeconds(existing, now);
    throw new TooManyRequestsError('too many attempts', { retryAfterSeconds });
  }

  const result = await consumeSettingsEmailVerificationCode({
    userId: user.id,
    email,
    code,
  });

  if (!result.ok) {
    const attempts = recordFailedAttempt(verifyKey, now);
    const entry = failedAttemptsByIdentifier.get(verifyKey)!;
    const retryAfterSeconds =
      attempts >= VERIFY_FAIL_MAX_ATTEMPTS
        ? remainingRetryAfterSeconds(entry, now)
        : undefined;

    log.warn('[API] verify email code failed', {
      userId: user.id,
      email: maskEmail(email),
      reason: result.reason,
      attempts,
    });

    if (retryAfterSeconds) {
      throw new TooManyRequestsError('too many attempts', {
        retryAfterSeconds,
      });
    }

    if (result.reason === 'expired') {
      throw new BadRequestError('verification code expired');
    }

    throw new BadRequestError('invalid verification code');
  }

  failedAttemptsByIdentifier.delete(verifyKey);

  log.info('[API] verify email code ok', {
    userId: user.id,
    email: maskEmail(email),
  });
  return jsonOk({ verified: true });
});
