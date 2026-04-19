import 'server-only';

import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import { db } from '@/core/db';
import * as schema from '@/config/db/schema';
import { buildResetPasswordEmailPayload } from '@/shared/content/email/reset-password';
import { getUuid } from '@/shared/lib/hash';
import { isAuthSpikeOAuthUpstreamMockEnabled } from '@/shared/lib/auth-spike-oauth-config';
import { isProductionEnv } from '@/shared/lib/env';
import { logger } from '@/shared/lib/logger.server';
import { getAllConfigsCached, type Configs } from '@/shared/models/config';
import {
  getRuntimeEnvString,
  getServerPublicEnvConfigs,
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
  isRuntimeEnvEnabled,
} from '@/shared/lib/runtime/env.server';
import {
  consumeResetPasswordQuota,
  releaseResetPasswordQuota,
} from '@/shared/models/reset_password_throttle';
import { getEmailService } from '@/shared/services/email';
import { installAuthSpikeOAuthFetchMock } from './oauth-spike.mock';
import {
  buildTrustedAuthOrigins,
  isExplicitLocalAuthRuntimeEnabled,
  resolveRuntimeAuthBaseUrl,
} from './runtime-origin';

function assertAuthEnv() {
  const isProduction = isProductionEnv();
  if (!isProduction) {
    return;
  }

  const runtimeEnv = getServerRuntimeEnv();

  if (!runtimeEnv.authSecret.trim()) {
    throw new Error(
      'BETTER_AUTH_SECRET or AUTH_SECRET is required in production for auth.'
    );
  }

  const rawAuthBaseUrl =
    getRuntimeEnvString('BETTER_AUTH_URL') ??
    getRuntimeEnvString('AUTH_URL') ??
    getRuntimeEnvString('NEXT_PUBLIC_APP_URL') ??
    '';

  if (!rawAuthBaseUrl.trim()) {
    throw new Error(
      'Auth base URL is required in production. Set BETTER_AUTH_URL or AUTH_URL or NEXT_PUBLIC_APP_URL.'
    );
  }

  if (!runtimeEnv.databaseUrl.trim() && !isCloudflareWorkersRuntime()) {
    throw new Error(
      'DATABASE_URL is required in production for Better Auth database adapter.'
    );
  }
}

function getAuthRuntimeContext(request?: Request) {
  const runtimeEnv = getServerRuntimeEnv();
  const publicEnvConfigs = getServerPublicEnvConfigs();
  const isProduction = isProductionEnv();
  const normalizedAuthBaseUrl = new URL(runtimeEnv.authBaseUrl).origin;
  const compiledAppOrigin =
    publicEnvConfigs.app_url && publicEnvConfigs.app_url !== normalizedAuthBaseUrl
      ? new URL(publicEnvConfigs.app_url).origin
      : null;
  const additionalAllowedAuthOrigins = compiledAppOrigin
    ? [compiledAppOrigin]
    : [];
  const isAuthSpikeOAuthUpstreamMock = isAuthSpikeOAuthUpstreamMockEnabled();
  const runtimeBaseUrl = resolveRuntimeAuthBaseUrl({
    defaultBaseUrl: normalizedAuthBaseUrl,
    additionalAllowedOrigins: additionalAllowedAuthOrigins,
    preferRequestOrigin: isAuthSpikeOAuthUpstreamMock,
    request,
  });
  const runtimeTrustedOrigins = buildTrustedAuthOrigins({
    appUrl: normalizedAuthBaseUrl,
    additionalAllowedOrigins: additionalAllowedAuthOrigins,
    request,
    preferRequestOrigin: isAuthSpikeOAuthUpstreamMock,
  });

  return {
    runtimeEnv,
    publicEnvConfigs,
    isProduction,
    normalizedAuthBaseUrl,
    additionalAllowedAuthOrigins,
    isAuthSpikeOAuthUpstreamMock,
    runtimeBaseUrl,
    runtimeTrustedOrigins,
  };
}

function buildAuthOptionsBase(): BetterAuthOptions {
  const {
    runtimeEnv,
    publicEnvConfigs,
    isProduction,
    normalizedAuthBaseUrl,
    additionalAllowedAuthOrigins,
  } = getAuthRuntimeContext();

  return {
    appName: publicEnvConfigs.app_name,
    baseURL: normalizedAuthBaseUrl,
    secret: runtimeEnv.authSecret,
    trustedOrigins: buildTrustedAuthOrigins({
      appUrl: normalizedAuthBaseUrl,
      additionalAllowedOrigins: additionalAllowedAuthOrigins,
      preferRequestOrigin: isExplicitLocalAuthRuntimeEnabled(),
    }),
    advanced: {
      disableOriginCheck: isAuthSpikeOAuthUpstreamMockEnabled(),
      database: {
        generateId: () => getUuid(),
      },
    },
    emailAndPassword: {
      enabled: true,
    },
    logger: {
      level: isProduction ? 'info' : 'debug',
      // Disable logs in production to reduce noise; keep debug in non-production
      disabled: isProduction && !isAuthSpikeOAuthUpstreamMockEnabled(),
    },
  };
}

export function getAuthOriginDebug(request?: Request) {
  const { runtimeBaseUrl, runtimeTrustedOrigins } = getAuthRuntimeContext(request);

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

type SendResetPasswordData = Parameters<
  NonNullable<
    NonNullable<BetterAuthOptions['emailAndPassword']>['sendResetPassword']
  >
>[0];

// Dynamic auth options - WITH database connection
// Only used in API routes that actually need database access
export async function getAuthOptions(
  request?: Request
): Promise<BetterAuthOptions> {
  installAuthSpikeOAuthFetchMock();
  assertAuthEnv();
  const baseAuthOptions = buildAuthOptionsBase();
  const configs = await getAllConfigsCached();
  const { publicEnvConfigs, isProduction, isAuthSpikeOAuthUpstreamMock } =
    getAuthRuntimeContext(request);
  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled);
  const { runtimeBaseUrl, runtimeTrustedOrigins } = getAuthOriginDebug(request);
  const appName = (configs.app_name || publicEnvConfigs.app_name || '').trim();
  const socialProviders = await getSocialProviders(configs, runtimeBaseUrl);
  if (isRuntimeEnvEnabled('CF_LOCAL_AUTH_DEBUG')) {
    logger.warn('[auth-debug] request origin resolution', {
      runtimeBaseUrl,
      runtimeTrustedOrigins,
      requestUrl: request?.url || null,
      requestOrigin: request?.headers.get('origin') || null,
      requestReferer: request?.headers.get('referer') || null,
      requestHost: request?.headers.get('host') || null,
      requestForwardedHost: request?.headers.get('x-forwarded-host') || null,
      requestForwardedProto: request?.headers.get('x-forwarded-proto') || null,
    });
  }
  if (isAuthSpikeOAuthUpstreamMock) {
    logger.info('[auth-spike-oauth] runtime auth origin', {
      runtimeBaseUrl,
      runtimeTrustedOrigins,
      requestOrigin: request?.headers.get('origin') || null,
      requestReferer: request?.headers.get('referer') || null,
    });
  }
  return {
    ...baseAuthOptions,
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
                subject: `${publicEnvConfigs.app_name} - Reset password`,
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
              await releaseResetPasswordQuota(quota.scopeKey).catch(
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
