import { PERMISSIONS } from '@/shared/constants/rbac-permissions';
import type { createApiContext } from '@/shared/lib/api/context';
import { BadRequestError, TooManyRequestsError } from '@/shared/lib/api/errors';
import { FixedWindowAttemptLimiter } from '@/shared/lib/api/limiters';
import { VERIFY_CODE_ATTEMPT_LIMIT_CONFIG } from '@/shared/lib/api/limiters-config';
import { jsonOk } from '@/shared/lib/api/response';
import { withApi } from '@/shared/lib/api/route';
import { maskEmail, normalizeEmail } from '@/shared/lib/email';
import { EmailVerifyCodeBodySchema } from '@/shared/schemas/api/email/verify-code';

type MaybePromise<T> = T | Promise<T>;
type VerifyCodeApiContext = Pick<
  Awaited<ReturnType<typeof createApiContext>>,
  'log' | 'parseJson' | 'requireUser' | 'requirePermission'
>;

type VerifyCodeRouteDeps = {
  getApiContext: (req: Request) => MaybePromise<VerifyCodeApiContext>;
  consumeSettingsEmailVerificationCode: (input: {
    userId: string;
    email: string;
    code: string;
  }) => Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'expired' | 'mismatch' }>;
  now: () => number;
};

function getDefaultVerifyCodeRouteDeps(): VerifyCodeRouteDeps {
  return {
    getApiContext: async (req) => {
      const mod = await import('@/shared/lib/api/context');
      return mod.createApiContext(req) as VerifyCodeApiContext;
    },
    consumeSettingsEmailVerificationCode: async (input) => {
      const mod = await import('@/shared/models/email_verification_code');
      return await mod.consumeSettingsEmailVerificationCode(input);
    },
    now: Date.now,
  };
}

function buildVerifyIdentifier(userId: string, email: string): string {
  return `${userId}|${normalizeEmail(email)}`;
}

export function createVerifyCodePostHandler(
  overrides: Partial<VerifyCodeRouteDeps> = {}
) {
  return withApi(buildVerifyCodePostLogic(overrides));
}

function buildVerifyCodePostLogic(
  overrides: Partial<VerifyCodeRouteDeps> = {}
) {
  const deps = { ...getDefaultVerifyCodeRouteDeps(), ...overrides };
  const verifyCodeAttemptLimiter = new FixedWindowAttemptLimiter({
    ...VERIFY_CODE_ATTEMPT_LIMIT_CONFIG,
    now: deps.now,
  });

  return async (req: Request) => {
    const api = await deps.getApiContext(req);
    const { log } = api;
    const user = await api.requireUser();
    await api.requirePermission(user.id, PERMISSIONS.SETTINGS_WRITE);

    const { email, code } = await api.parseJson(EmailVerifyCodeBodySchema);
    const now = deps.now();

    const verifyKey = buildVerifyIdentifier(user.id, email);
    const existing = verifyCodeAttemptLimiter.check(verifyKey, now);
    if (!existing.allowed) {
      throw new TooManyRequestsError('too many attempts', {
        retryAfterSeconds: existing.retryAfterSeconds,
      });
    }

    const result = await deps.consumeSettingsEmailVerificationCode({
      userId: user.id,
      email,
      code,
    });

    if (!result.ok) {
      const attempt = verifyCodeAttemptLimiter.recordFailure(verifyKey, now);
      const retryAfterSeconds = attempt.retryAfterSeconds;

      log.warn('[API] verify email code failed', {
        userId: user.id,
        email: maskEmail(email),
        reason: result.reason,
        attempts: attempt.attempts,
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

    verifyCodeAttemptLimiter.clear(verifyKey);

    log.info('[API] verify email code ok', {
      userId: user.id,
      email: maskEmail(email),
    });
    return jsonOk({ verified: true });
  };
}

export const POST = withApi(buildVerifyCodePostLogic());
