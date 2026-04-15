import { randomInt } from 'crypto';

import type { EmailSendResult } from '@/extensions/email';
import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import { buildVerificationCodeEmailPayload } from '@/shared/content/email/verification-code';
import { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  TooManyRequestsError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { maskEmail, normalizeEmail } from '@/shared/lib/email';
import { cleanupExpiringMap } from '@/shared/lib/map-cleanup';
import {
  deleteEmailVerificationCodeById,
  deleteEmailVerificationCodesByIdentifierExceptId,
  persistSettingsEmailVerificationCode,
} from '@/shared/models/email_verification_code';
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import { getEmailService } from '@/shared/services/email';

const MAX_EMAIL_RECIPIENTS = 10;
const MIN_SEND_INTERVAL_MS = 60_000;
const SEND_THROTTLE_TTL_MS = 15 * 60 * 1000;
const SEND_THROTTLE_MAX_ENTRIES = 10_000;
let sendThrottleCleanupTick = 0;
const recentSendByUserAndEmail = new Map<string, number>();

function cleanupSendThrottle(now: number) {
  cleanupExpiringMap({
    map: recentSendByUserAndEmail,
    now,
    ttlMs: SEND_THROTTLE_TTL_MS,
    maxEntries: SEND_THROTTLE_MAX_ENTRIES,
    getTimestamp: (lastAt) => lastAt,
  });
}

function uniqueNormalizedEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const user = await api.requireUser();
  await api.requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);
  const { emails, subject } = await api.parseJson(EmailSendBodySchema);

  const recipientsRaw = Array.isArray(emails) ? emails : [emails];
  const recipients = uniqueNormalizedEmails(recipientsRaw);

  if (recipients.length > MAX_EMAIL_RECIPIENTS) {
    throw new BadRequestError(
      `too many recipients (max ${MAX_EMAIL_RECIPIENTS})`
    );
  }

  const now = Date.now();

  if ((sendThrottleCleanupTick++ & 0xff) === 0) {
    cleanupSendThrottle(now);
  }

  const throttled = recipients
    .map((email) => {
      const key = `${user.id}|${email}`;
      const lastSentAt = recentSendByUserAndEmail.get(key);
      if (!lastSentAt || now - lastSentAt >= MIN_SEND_INTERVAL_MS) {
        return null;
      }
      const retryAfterSeconds = Math.ceil(
        (MIN_SEND_INTERVAL_MS - (now - lastSentAt)) / 1000
      );
      return { email, retryAfterSeconds };
    })
    .filter(
      (
        x
      ): x is {
        email: string;
        retryAfterSeconds: number;
      } => x !== null
    );

  if (throttled.length > 0) {
    const retryAfterSeconds = Math.max(
      ...throttled.map((item) => item.retryAfterSeconds)
    );
    log.warn('[API] send email throttled', {
      userId: user.id,
      retryAfterSeconds,
    });
    throw new TooManyRequestsError('too many requests', { retryAfterSeconds });
  }

  const emailService = await getEmailService().catch((error: unknown) => {
    log.error('[API] Email service init failed', { error });
    throw new UpstreamError(503, 'email service unavailable');
  });

  const results: Array<{ email: string; result: EmailSendResult }> = [];
  const isSingleRecipient = recipients.length === 1;

  for (const email of recipients) {
    const rateLimitKey = `${user.id}|${email}`;
    recentSendByUserAndEmail.set(rateLimitKey, now);

    const rollbackRateLimit = () => {
      const current = recentSendByUserAndEmail.get(rateLimitKey);
      if (current === now) {
        recentSendByUserAndEmail.delete(rateLimitKey);
      }
    };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');

    let verification: { id: string; identifier: string } | null = null;
    try {
      verification = await persistSettingsEmailVerificationCode({
        userId: user.id,
        email,
        code,
      });
    } catch (error: unknown) {
      rollbackRateLimit();
      log.error('[API] persist verification code failed', {
        error,
        userId: user.id,
        email: maskEmail(email),
      });
      if (isSingleRecipient) {
        throw new UpstreamError(503, 'verification service unavailable');
      }
      results.push({
        email,
        result: {
          success: false,
          provider: 'unknown',
          error: 'verification service unavailable',
        },
      });
      continue;
    }

    let sendResult: EmailSendResult;
    try {
      sendResult = await emailService.sendEmail({
        to: email,
        subject,
        ...buildVerificationCodeEmailPayload({ code }),
      });
    } catch (error: unknown) {
      rollbackRateLimit();
      void deleteEmailVerificationCodeById(verification.id).catch(
        (cleanupError: unknown) => {
          log.error('[API] rollback verification code failed', {
            cleanupError,
          });
        }
      );
      log.error('[API] sendEmail threw', {
        error,
        userId: user.id,
        email: maskEmail(email),
      });
      if (isSingleRecipient) {
        throw new UpstreamError(503, 'email service unavailable');
      }
      results.push({
        email,
        result: {
          success: false,
          provider: 'unknown',
          error: 'email service unavailable',
        },
      });
      continue;
    }

    if (!sendResult.success) {
      rollbackRateLimit();
      void deleteEmailVerificationCodeById(verification.id).catch(
        (cleanupError: unknown) => {
          log.error('[API] rollback verification code failed', {
            cleanupError,
          });
        }
      );
      log.error('[API] sendEmail failed', {
        provider: sendResult.provider,
        error: sendResult.error,
        userId: user.id,
        email: maskEmail(email),
      });
      if (isSingleRecipient) {
        throw new UpstreamError(502, 'send email failed');
      }
      results.push({ email, result: sendResult });
      continue;
    }

    void deleteEmailVerificationCodesByIdentifierExceptId({
      identifier: verification.identifier,
      keepId: verification.id,
    }).catch((cleanupError: unknown) => {
      log.error('[API] cleanup verification codes failed', {
        cleanupError,
        userId: user.id,
      });
    });

    results.push({ email, result: sendResult });
  }

  const anySuccess = results.some((item) => item.result.success);
  const provider =
    results.find((item) => item.result.success)?.result.provider ?? 'unknown';
  const messageId = results.find((item) => item.result.success)?.result
    .messageId;

  log.debug('send email result', {
    emailCount: recipients.length,
    success: anySuccess,
    provider,
    messageId,
    failures: results.filter((item) => !item.result.success).length,
  });

  if (isSingleRecipient) {
    return jsonOk(
      results[0]?.result ?? { success: false, provider: 'unknown' }
    );
  }

  return jsonOk({
    success: anySuccess,
    provider,
    messageId,
    results: results.map(({ email, result }) => ({ email, ...result })),
  });
});
