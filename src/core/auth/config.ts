import 'server-only';

import { createRequire } from 'node:module';
import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { buildResetPasswordEmailPayload } from '@/shared/content/email/reset-password';
import { isCloudflareWorker } from '@/shared/lib/env';
import { getUuid } from '@/shared/lib/hash';
import { logger } from '@/shared/lib/logger.server';
import { getAllConfigs, type Configs } from '@/shared/models/config';
import { getEmailService } from '@/shared/services/email';

type ResetPasswordThrottle = {
  windowStartedAt: number;
  count: number;
  inflight: number;
};

const RESET_PASSWORD_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const RESET_PASSWORD_MAX_ATTEMPTS = 3;
const RESET_PASSWORD_MAX_CONCURRENT = 1;
const RESET_PASSWORD_MAX_ENTRIES = 5_000;
let resetPasswordCleanupTick = 0;
const resetPasswordThrottleByEmail = new Map<string, ResetPasswordThrottle>();

function cleanupResetPasswordThrottle(now: number) {
  for (const [email, state] of resetPasswordThrottleByEmail.entries()) {
    if (now - state.windowStartedAt > RESET_PASSWORD_WINDOW_MS) {
      resetPasswordThrottleByEmail.delete(email);
    }
  }

  if (resetPasswordThrottleByEmail.size <= RESET_PASSWORD_MAX_ENTRIES) {
    return;
  }

  let removed = 0;
  const overflow =
    resetPasswordThrottleByEmail.size - RESET_PASSWORD_MAX_ENTRIES;
  for (const email of resetPasswordThrottleByEmail.keys()) {
    resetPasswordThrottleByEmail.delete(email);
    removed += 1;
    if (removed >= overflow) break;
  }
}

function consumeResetPasswordQuota(email: string): {
  allowed: boolean;
  reason?: string;
} {
  const now = Date.now();

  if ((resetPasswordCleanupTick++ & 0xff) === 0) {
    cleanupResetPasswordThrottle(now);
  }

  const existing = resetPasswordThrottleByEmail.get(email);
  const state: ResetPasswordThrottle = existing
    ? { ...existing }
    : { windowStartedAt: now, count: 0, inflight: 0 };

  if (now - state.windowStartedAt > RESET_PASSWORD_WINDOW_MS) {
    state.windowStartedAt = now;
    state.count = 0;
    state.inflight = 0;
  }

  if (state.count >= RESET_PASSWORD_MAX_ATTEMPTS) {
    return { allowed: false, reason: 'rate_limited' };
  }

  if (state.inflight >= RESET_PASSWORD_MAX_CONCURRENT) {
    return { allowed: false, reason: 'concurrency_limit' };
  }

  state.count += 1;
  state.inflight += 1;
  resetPasswordThrottleByEmail.set(email, state);

  return { allowed: true };
}

function releaseResetPasswordQuota(email: string) {
  const state = resetPasswordThrottleByEmail.get(email);
  if (!state) return;

  state.inflight = Math.max(0, state.inflight - 1);
  resetPasswordThrottleByEmail.set(email, state);
}

function normalizeOrigin(value: string, label: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('must use http or https');
    }
    return url.origin;
  } catch (error) {
    throw new Error(`Invalid ${label} origin: ${value} (${String(error)})`);
  }
}

function buildTrustedOrigins(appUrl: string): string[] {
  const origins = new Set<string>();
  origins.add(normalizeOrigin(appUrl, 'NEXT_PUBLIC_APP_URL'));
  origins.add('https://accounts.google.com');
  return [...origins];
}

function isCloudflareWorkersRuntime(): boolean {
  if (isCloudflareWorker) return true;

  try {
    const require = createRequire(import.meta.url);
    // Prevent webpack from trying to resolve the `cloudflare:` scheme at build time.
    // This module only exists in Cloudflare Workers runtime (nodejs_compat).
    const workers = require(['cloudflare', 'workers'].join(':')) as unknown;
    return Boolean(workers && typeof workers === 'object' && 'env' in workers);
  } catch {
    return false;
  }
}

function assertAuthEnv() {
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    return;
  }

  if (!serverEnv.authSecret.trim()) {
    throw new Error(
      'BETTER_AUTH_SECRET or AUTH_SECRET is required in production for auth.'
    );
  }

  const rawAuthBaseUrl =
    process.env.BETTER_AUTH_URL ??
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    '';

  if (!rawAuthBaseUrl.trim()) {
    throw new Error(
      'Auth base URL is required in production. Set BETTER_AUTH_URL or AUTH_URL or NEXT_PUBLIC_APP_URL.'
    );
  }

  if (!serverEnv.databaseUrl.trim() && !isCloudflareWorkersRuntime()) {
    throw new Error(
      'DATABASE_URL is required in production for Better Auth database adapter.'
    );
  }
}

const trustedOrigins = buildTrustedOrigins(envConfigs.app_url);
const isProduction = process.env.NODE_ENV === 'production';
const normalizedAuthBaseUrl = normalizeOrigin(
  serverEnv.authBaseUrl,
  'auth base URL'
);

// Static auth options - NO database connection
// This ensures zero database calls during build time
export const authOptions = {
  appName: envConfigs.app_name,
  baseURL: normalizedAuthBaseUrl,
  secret: serverEnv.authSecret,
  trustedOrigins,
  advanced: {
    database: {
      generateId: () => getUuid(),
    },
  },
  emailAndPassword: {
    enabled: true,
  },
  logger: {
    verboseLogging: !isProduction,
    // Disable logs in production to reduce noise; keep debug in non-production
    disabled: isProduction,
  },
};

type SendResetPasswordData = Parameters<
  NonNullable<
    NonNullable<BetterAuthOptions['emailAndPassword']>['sendResetPassword']
  >
>[0];

// Dynamic auth options - WITH database connection
// Only used in API routes that actually need database access
export async function getAuthOptions() {
  assertAuthEnv();
  const configs = await getAllConfigs();
  const isEmailAuthEnabled = configs.email_auth_enabled !== 'false';
  const socialProviders = await getSocialProviders(configs);
  return {
    ...authOptions,
    // Add database connection only when actually needed (runtime)
    database: drizzleAdapter(db(), {
      provider: 'pg',
      schema: schema,
    }),
    emailAndPassword: isEmailAuthEnabled
      ? {
          enabled: true,
          sendResetPassword: async ({ user, url }: SendResetPasswordData) => {
            void (async () => {
              const email = user?.email?.trim().toLowerCase();
              if (!email) {
                return;
              }

              const quota = consumeResetPasswordQuota(email);
              if (!quota.allowed) {
                logger.warn('[auth] sendResetPassword throttled', {
                  userId: user.id,
                  reason: quota.reason,
                });
                return;
              }

              try {
                const emailService = await getEmailService();
                const result = await emailService.sendEmail({
                  to: email,
                  subject: `${envConfigs.app_name} - Reset password`,
                  ...buildResetPasswordEmailPayload({ url }),
                });

                if (!result.success) {
                  logger.error('[auth] sendResetPassword failed', {
                    userId: user.id,
                    provider: result.provider,
                    error: result.error,
                  });
                  return;
                }

                if (!isProduction) {
                  logger.debug('[auth] sendResetPassword ok', {
                    userId: user.id,
                    provider: result.provider,
                    messageId: result.messageId,
                  });
                }
              } catch (error: unknown) {
                logger.error('[auth] sendResetPassword threw', {
                  userId: user.id,
                  error,
                });
              } finally {
                releaseResetPasswordQuota(email);
              }
            })();
          },
        }
      : { enabled: false },
    socialProviders,
    plugins:
      socialProviders.google && configs.google_one_tap_enabled === 'true'
        ? [oneTap()]
        : [],
  };
}

export async function getSocialProviders(configs: Configs) {
  // get configs from db
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {};

  const googleEnabled = configs.google_auth_enabled === 'true';
  const githubEnabled = configs.github_auth_enabled === 'true';

  if (
    googleEnabled &&
    configs.google_client_id &&
    configs.google_client_secret
  ) {
    providers.google = {
      clientId: configs.google_client_id,
      clientSecret: configs.google_client_secret,
    };
  }

  if (
    githubEnabled &&
    configs.github_client_id &&
    configs.github_client_secret
  ) {
    providers.github = {
      clientId: configs.github_client_id,
      clientSecret: configs.github_client_secret,
    };
  }

  return providers;
}
