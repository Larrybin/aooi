import { randomInt } from 'crypto';

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
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import { getEmailService } from '@/shared/services/email';

const MAX_EMAIL_RECIPIENTS = 10;
const EMAIL_TEST_WINDOW_MS = 5 * 60 * 1000;
const EMAIL_TEST_MAX_ATTEMPTS = 3;
const EMAIL_TEST_MAX_CONCURRENT = 1;
const EMAIL_TEST_MAX_ENTRIES = 5_000;

type EmailTestThrottle = {
  windowStartedAt: number;
  count: number;
  inflight: number;
};

let throttleCleanupTick = 0;
const emailTestThrottleByUser = new Map<string, EmailTestThrottle>();

function cleanupEmailTestThrottle(now: number) {
  for (const [userId, state] of emailTestThrottleByUser.entries()) {
    if (now - state.windowStartedAt > EMAIL_TEST_WINDOW_MS) {
      emailTestThrottleByUser.delete(userId);
    }
  }

  if (emailTestThrottleByUser.size <= EMAIL_TEST_MAX_ENTRIES) {
    return;
  }

  let removed = 0;
  const overflow = emailTestThrottleByUser.size - EMAIL_TEST_MAX_ENTRIES;
  for (const userId of emailTestThrottleByUser.keys()) {
    emailTestThrottleByUser.delete(userId);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function consumeEmailTestQuota(userId: string): {
  allowed: boolean;
  reason?: string;
} {
  const now = Date.now();

  if ((throttleCleanupTick++ & 0xff) === 0) {
    cleanupEmailTestThrottle(now);
  }

  const existing = emailTestThrottleByUser.get(userId);
  const state: EmailTestThrottle = existing
    ? { ...existing }
    : { windowStartedAt: now, count: 0, inflight: 0 };

  if (now - state.windowStartedAt > EMAIL_TEST_WINDOW_MS) {
    state.windowStartedAt = now;
    state.count = 0;
    state.inflight = 0;
  }

  if (state.count >= EMAIL_TEST_MAX_ATTEMPTS) {
    return { allowed: false, reason: 'rate_limited' };
  }

  if (state.inflight >= EMAIL_TEST_MAX_CONCURRENT) {
    return { allowed: false, reason: 'concurrency_limit' };
  }

  state.count += 1;
  state.inflight += 1;
  emailTestThrottleByUser.set(userId, state);

  return { allowed: true };
}

function releaseEmailTestQuota(userId: string) {
  const state = emailTestThrottleByUser.get(userId);
  if (!state) return;

  state.inflight = Math.max(0, state.inflight - 1);
  emailTestThrottleByUser.set(userId, state);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const POST = withApi(async (req: Request) => {
  const api = createApiContext(req);
  const { log } = api;
  const user = await api.requireUser();
  await api.requirePermission(user.id, PERMISSIONS.EMAIL_TEST);

  const quota = consumeEmailTestQuota(user.id);
  if (!quota.allowed) {
    log.warn('[API] email test throttled', {
      userId: user.id,
      reason: quota.reason,
    });
    throw new TooManyRequestsError('rate limited');
  }
  try {
    const { emails, subject } = await api.parseJson(EmailSendBodySchema);

    const to = Array.isArray(emails) ? emails : [emails];
    if (to.length > MAX_EMAIL_RECIPIENTS) {
      throw new BadRequestError(
        `too many recipients (max ${MAX_EMAIL_RECIPIENTS})`
      );
    }

    let emailService;
    try {
      emailService = await getEmailService();
    } catch (error: unknown) {
      log.error('[API] Email service init failed', {
        error: getErrorMessage(error),
      });
      throw new UpstreamError(503, 'email service unavailable');
    }

    let result;
    try {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      result = await emailService.sendEmail({
        to,
        subject,
        ...buildVerificationCodeEmailPayload({ code }),
      });
    } catch (error: unknown) {
      log.error('[API] sendEmail threw', { error: getErrorMessage(error) });
      throw new UpstreamError(503, 'email service unavailable');
    }

    if (!result.success) {
      log.error('[API] sendEmail failed', {
        provider: result.provider,
        error: result.error,
      });
      throw new UpstreamError(502, 'send email failed');
    }

    log.debug('send email result', {
      emailCount: Array.isArray(emails) ? emails.length : 1,
      success: result.success,
      messageId: result.messageId,
      provider: result.provider,
    });
    return jsonOk(result);
  } finally {
    releaseEmailTestQuota(user.id);
  }
});
