import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import * as schema from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { buildResetPasswordEmailPayload } from '@/shared/content/email/reset-password';
import { getUuid } from '@/shared/lib/hash';
import { logger } from '@/shared/lib/logger.server';
import { getAllConfigs } from '@/shared/models/config';
import { getEmailService } from '@/shared/services/email';

// Trusted origins for Better Auth
// - app_url: current application origin
// - https://accounts.google.com: Google One Tap / FedCM origin
const trustedOrigins: string[] = [];

if (envConfigs.app_url) {
  trustedOrigins.push(envConfigs.app_url);
}

trustedOrigins.push('https://accounts.google.com');

// Static auth options - NO database connection
// This ensures zero database calls during build time
export const authOptions = {
  appName: envConfigs.app_name,
  baseURL: serverEnv.authBaseUrl,
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
    verboseLogging: false,
    // Disable all logs during build and production
    disabled: true,
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
  const configs = await getAllConfigs();
  const isEmailAuthEnabled = configs.email_auth_enabled !== 'false';
  return {
    ...authOptions,
    // Add database connection only when actually needed (runtime)
    database: serverEnv.databaseUrl
      ? drizzleAdapter(db(), {
          provider: 'pg',
          schema: schema,
        })
      : null,
    emailAndPassword: isEmailAuthEnabled
      ? {
          enabled: true,
          sendResetPassword: async ({ user, url }: SendResetPasswordData) => {
            void (async () => {
              if (!user?.email) {
                return;
              }

              try {
                const emailService = await getEmailService();
                const result = await emailService.sendEmail({
                  to: user.email,
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

                logger.debug('[auth] sendResetPassword ok', {
                  userId: user.id,
                  provider: result.provider,
                  messageId: result.messageId,
                });
              } catch (error: unknown) {
                logger.error('[auth] sendResetPassword threw', {
                  userId: user.id,
                  error,
                });
              }
            })();
          },
        }
      : { enabled: false },
    socialProviders: await getSocialProviders(configs),
    plugins:
      configs.google_client_id && configs.google_one_tap_enabled === 'true'
        ? [oneTap()]
        : [],
  };
}

export async function getSocialProviders(configs: Record<string, string>) {
  // get configs from db
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {};

  if (configs.google_client_id && configs.google_client_secret) {
    providers.google = {
      clientId: configs.google_client_id,
      clientSecret: configs.google_client_secret,
    };
  }

  if (configs.github_client_id && configs.github_client_secret) {
    providers.github = {
      clientId: configs.github_client_id,
      clientSecret: configs.github_client_secret,
    };
  }

  return providers;
}
