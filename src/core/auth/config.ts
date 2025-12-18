import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { oneTap } from 'better-auth/plugins';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { serverEnv } from '@/config/server';
import * as schema from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';
import { getAllConfigs } from '@/shared/models/config';

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

// Dynamic auth options - WITH database connection
// Only used in API routes that actually need database access
export async function getAuthOptions() {
  const configs = await getAllConfigs();
  return {
    ...authOptions,
    // Add database connection only when actually needed (runtime)
    database: serverEnv.databaseUrl
      ? drizzleAdapter(db(), {
          provider: getDatabaseProvider(serverEnv.databaseProvider),
          schema: schema,
        })
      : null,
    emailAndPassword: {
      enabled: configs.email_auth_enabled !== 'false',
    },
    socialProviders: await getSocialProviders(configs),
    plugins:
      configs.google_client_id && configs.google_one_tap_enabled === 'true'
        ? [oneTap()]
        : [],
  };
}

export async function getSocialProviders(configs: Record<string, string>) {
  // get configs from db
  const providers: any = {};

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

export function getDatabaseProvider(
  provider: string
): 'sqlite' | 'pg' | 'mysql' {
  switch (provider) {
    case 'sqlite':
      return 'sqlite';
    case 'postgresql':
      return 'pg';
    case 'mysql':
      return 'mysql';
    default:
      throw new Error(
        `Unsupported database provider for auth: ${provider}`
      );
  }
}
