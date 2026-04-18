import { randomInt } from 'crypto';

import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { buildVerificationCodeEmailPayload as buildVerificationCodeEmailPayloadFn } from '@/shared/content/email/verification-code';
import type { createApiContext } from '@/shared/lib/api/context';
import {
  BadRequestError,
  TooManyRequestsError,
  UpstreamError,
} from '@/shared/lib/api/errors';
import { createLimiterFactory } from '@/shared/lib/api/limiters-factory';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { EmailSendBodySchema } from '@/shared/schemas/api/email/send-email';
import type { getEmailService as getEmailServiceFn } from '@/shared/services/email';

const MAX_EMAIL_RECIPIENTS = 10;

type MaybePromise<T> = T | Promise<T>;
type EmailTestApiContext = Pick<
  Awaited<ReturnType<typeof createApiContext>>,
  'log' | 'parseJson' | 'requireUser' | 'requirePermission'
>;
type EmailTestService = Awaited<ReturnType<typeof getEmailServiceFn>>;
type BuildVerificationCodeEmailPayload =
  typeof buildVerificationCodeEmailPayloadFn;

type EmailTestRouteDeps = {
  getApiContext: (req: Request) => MaybePromise<EmailTestApiContext>;
  getEmailService: () => Promise<EmailTestService>;
  buildVerificationCodeEmailPayload: (
    input: Parameters<BuildVerificationCodeEmailPayload>[0]
  ) => MaybePromise<ReturnType<BuildVerificationCodeEmailPayload>>;
  quotaLimiter: {
    acquire: (key: string, now?: number) => Promise<{
      allowed: boolean;
      reason?: string;
    }>;
    release: (key: string, now?: number) => Promise<void>;
  };
  now: () => number;
  randomInt: typeof randomInt;
};

function getDefaultEmailTestRouteDeps(): EmailTestRouteDeps {
  return {
    getApiContext: async (req) => {
      const mod = await import('@/shared/lib/api/context');
      return mod.createApiContext(req) as EmailTestApiContext;
    },
    getEmailService: async () => {
      const mod = await import('@/shared/services/email');
      return await mod.getEmailService();
    },
    buildVerificationCodeEmailPayload: async (input) => {
      const mod = await import('@/shared/content/email/verification-code');
      return mod.buildVerificationCodeEmailPayload(input);
    },
    quotaLimiter: createLimiterFactory().createEmailTestQuotaLimiter(),
    now: Date.now,
    randomInt,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildEmailTestPostLogic(
  overrides: Partial<EmailTestRouteDeps> = {}
) {
  const deps = { ...getDefaultEmailTestRouteDeps(), ...overrides };

  return async (req: Request) => {
    const api = await deps.getApiContext(req);
    const { log } = api;
    const user = await api.requireUser();
    await api.requirePermission(user.id, PERMISSIONS.EMAIL_TEST);

    const quota = await deps.quotaLimiter.acquire(user.id);
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
        emailService = await deps.getEmailService();
      } catch (error: unknown) {
        log.error('[API] Email service init failed', {
          error: getErrorMessage(error),
        });
        throw new UpstreamError(503, 'email service unavailable');
      }

      let result;
      try {
        const code = String(deps.randomInt(0, 1_000_000)).padStart(6, '0');
        result = await emailService.sendEmail({
          to,
          subject,
          ...(await deps.buildVerificationCodeEmailPayload({ code })),
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
      await deps.quotaLimiter.release(user.id);
    }
  };
}

export function createEmailTestPostHandler(
  overrides: Partial<EmailTestRouteDeps> = {}
) {
  return withApi(buildEmailTestPostLogic(overrides));
}

export const POST = withApi(buildEmailTestPostLogic());
