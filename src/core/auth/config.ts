import 'server-only';

import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { buildResetPasswordEmailPayload } from '@/shared/content/email/reset-password';
import { isCloudflareWorkersRuntime } from '@/shared/lib/cloudflare-workers-env.server';
import { getUuid } from '@/shared/lib/hash';
import { logger } from '@/shared/lib/logger.server';
import { getAllConfigs, type Configs } from '@/shared/models/config';
import {
  consumeResetPasswordQuota,
  releaseResetPasswordQuota,
} from '@/shared/models/reset_password_throttle';
import { getEmailService } from '@/shared/services/email';

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

  if (isCloudflareWorkersRuntime()) {
    origins.add('http://127.0.0.1:8787');
    origins.add('http://localhost:8787');
  }

  origins.add('https://accounts.google.com');
  return [...origins];
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
  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled);
  const socialProviders = await getSocialProviders(configs);
  const appName = (configs.app_name || envConfigs.app_name || '').trim();
  return {
    ...authOptions,
    appName,
    // Add database connection only when actually needed (runtime)
    database: drizzleAdapter(db(), {
      provider: 'pg',
      schema: schema,
    }),
    emailAndPassword: isEmailAuthEnabled
      ? {
          enabled: true,
          sendResetPassword: async ({ user, url }: SendResetPasswordData) => {
            const email = user?.email?.trim().toLowerCase();
            if (!email) {
              return;
            }

            let quota: Awaited<ReturnType<typeof consumeResetPasswordQuota>>;
            try {
              quota = await consumeResetPasswordQuota(email);
            } catch (error: unknown) {
              logger.error('[auth] sendResetPassword throttle check failed', {
                userId: user.id,
                error,
              });
              return;
            }

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
              await releaseResetPasswordQuota(quota.inflightId).catch(
                (error: unknown) => {
                  logger.error(
                    '[auth] sendResetPassword throttle release failed',
                    {
                      userId: user.id,
                      error,
                    }
                  );
                }
              );
            }
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
