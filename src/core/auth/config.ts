import 'server-only';

import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { buildResetPasswordEmailPayload } from '@/shared/content/email/reset-password';
import { getUuid } from '@/shared/lib/hash';
import { isAuthSpikeOAuthMockEnabled } from '@/shared/lib/auth-spike-oauth-config';
import { logger } from '@/shared/lib/logger.server';
import { getAllConfigs, type Configs } from '@/shared/models/config';
import { isCloudflareWorkersRuntime } from '@/shared/lib/runtime/env.server';
import {
  consumeResetPasswordQuota,
  releaseResetPasswordQuota,
} from '@/shared/models/reset_password_throttle';
import { getEmailService } from '@/shared/services/email';
import { installAuthSpikeOAuthFetchMock } from './oauth-spike.mock';
import {
  buildTrustedAuthOrigins,
  resolveRuntimeAuthBaseUrl,
} from './runtime-origin';

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

const isProduction = process.env.NODE_ENV === 'production';
const normalizedAuthBaseUrl = new URL(serverEnv.authBaseUrl).origin;

export function getAuthOriginDebug(request?: Request) {
  const isAuthSpikeOAuthMock = isAuthSpikeOAuthMockEnabled();
  const runtimeBaseUrl = resolveRuntimeAuthBaseUrl({
    defaultBaseUrl: normalizedAuthBaseUrl,
    preferRequestOrigin: isAuthSpikeOAuthMock,
    request,
  });
  const runtimeTrustedOrigins = buildTrustedAuthOrigins({
    appUrl: envConfigs.app_url,
    request,
    allowLocalMockOrigins: isAuthSpikeOAuthMock,
  });

  return {
    runtimeBaseUrl,
    runtimeTrustedOrigins,
    requestUrl: request?.url || null,
    requestOrigin: request?.headers.get('origin') || null,
    requestReferer: request?.headers.get('referer') || null,
    requestHost: request?.headers.get('host') || null,
    requestForwardedHost: request?.headers.get('x-forwarded-host') || null,
    requestForwardedProto: request?.headers.get('x-forwarded-proto') || null,
  };
}

// Static auth options - NO database connection
// This ensures zero database calls during build time
export const authOptions = {
  appName: envConfigs.app_name,
  baseURL: normalizedAuthBaseUrl,
  secret: serverEnv.authSecret,
  trustedOrigins: buildTrustedAuthOrigins({
    appUrl: envConfigs.app_url,
    allowLocalMockOrigins: process.env.AUTH_SPIKE_OAUTH_MOCK === 'true',
  }),
  advanced: {
    disableOriginCheck: isAuthSpikeOAuthMockEnabled(),
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
    disabled: isProduction && !isAuthSpikeOAuthMockEnabled(),
  },
};

type SendResetPasswordData = Parameters<
  NonNullable<
    NonNullable<BetterAuthOptions['emailAndPassword']>['sendResetPassword']
  >
>[0];

// Dynamic auth options - WITH database connection
// Only used in API routes that actually need database access
export async function getAuthOptions(request?: Request) {
  installAuthSpikeOAuthFetchMock();
  assertAuthEnv();
  const configs = await getAllConfigs();
  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled);
  const appName = (configs.app_name || envConfigs.app_name || '').trim();
  const { runtimeBaseUrl, runtimeTrustedOrigins } = getAuthOriginDebug(request);
  const socialProviders = await getSocialProviders(configs, runtimeBaseUrl);
  if (isAuthSpikeOAuthMockEnabled()) {
    logger.info('[auth-spike-oauth] runtime auth origin', {
      runtimeBaseUrl,
      runtimeTrustedOrigins,
      requestOrigin: request?.headers.get('origin') || null,
      requestReferer: request?.headers.get('referer') || null,
    });
  }
  return {
    ...authOptions,
    appName,
    baseURL: runtimeBaseUrl,
    trustedOrigins: async () => runtimeTrustedOrigins,
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

function buildSocialProviderRedirectURI(authBaseUrl: string, provider: string) {
  return `${authBaseUrl.replace(/\/+$/, '')}/api/auth/callback/${provider}`;
}

export async function getSocialProviders(configs: Configs, authBaseUrl: string) {
  // get configs from db
  const providers: Record<
    string,
    { clientId: string; clientSecret: string; redirectURI: string }
  > = {};

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
      redirectURI: buildSocialProviderRedirectURI(authBaseUrl, 'google'),
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
      redirectURI: buildSocialProviderRedirectURI(authBaseUrl, 'github'),
    };
  }

  return providers;
}
