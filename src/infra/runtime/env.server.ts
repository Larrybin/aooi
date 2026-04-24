import { assertPostgresOnlyDatabaseProvider } from '@/infra/runtime/database-provider';
import { getCloudflareContext } from '@opennextjs/cloudflare';

import {
  resolvePublicEnvConfigs,
  type PublicEnvConfigs,
} from '@/config/public-env';
import { resolveServerAuthBaseUrl } from '@/config/server-auth-base-url';
import { isCloudflareWorker } from '@/shared/lib/env';

export type RuntimePlatform = 'node' | 'cloudflare-workers';

export type CloudflareBindings = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  APP_STORAGE_R2_BUCKET?: R2Bucket;
  NEXT_CACHE_DO_QUEUE?: unknown;
  NEXT_TAG_CACHE_DO_SHARDED?: unknown;
  STATEFUL_LIMITERS?: unknown;
  BETTER_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_SIGNING_SECRET?: string;
  CREEM_API_KEY?: string;
  CREEM_SIGNING_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_WEBHOOK_ID?: string;
  OPENROUTER_API_KEY?: string;
  REPLICATE_API_TOKEN?: string;
  FAL_API_KEY?: string;
  KIE_API_KEY?: string;
  STORAGE_PUBLIC_BASE_URL?: string;
} & Record<string, unknown>;

type RuntimeEnvOptions = {
  env?: NodeJS.ProcessEnv;
  bindings?: CloudflareBindings | null;
};

export type ServerRuntimeEnv = {
  databaseProvider: string;
  databaseUrl: string;
  dbSingletonEnabled: boolean;
  authSecret: string;
  authBaseUrl: string;
};

export function getCloudflareBindings(): CloudflareBindings | null {
  try {
    const { env } = getCloudflareContext();
    return { ...env };
  } catch {
    return null;
  }
}

function getBindingsValue(
  name: string,
  bindings: CloudflareBindings | null
): string | undefined {
  const value = bindings?.[name];
  return typeof value === 'string' ? value : undefined;
}

export function getRuntimeEnvString(
  name: string,
  options: RuntimeEnvOptions = {}
): string | undefined {
  const bindings =
    options.bindings === undefined ? getCloudflareBindings() : options.bindings;
  const bindingValue = getBindingsValue(name, bindings);
  if (bindingValue !== undefined) {
    return bindingValue;
  }

  return options.env?.[name] ?? process.env[name];
}

export function isRuntimeEnvEnabled(
  name: string,
  options: RuntimeEnvOptions = {}
): boolean {
  return getRuntimeEnvString(name, options) === 'true';
}

export function getServerRuntimeEnv(
  options: RuntimeEnvOptions = {}
): ServerRuntimeEnv {
  const envLike = {
    BETTER_AUTH_URL: getRuntimeEnvString('BETTER_AUTH_URL', options),
    AUTH_URL: getRuntimeEnvString('AUTH_URL', options),
  };
  const databaseProvider =
    getRuntimeEnvString('DATABASE_PROVIDER', options) ?? '';

  assertPostgresOnlyDatabaseProvider(databaseProvider);

  return {
    databaseProvider,
    databaseUrl: getRuntimeEnvString('DATABASE_URL', options) ?? '',
    dbSingletonEnabled: isRuntimeEnvEnabled('DB_SINGLETON_ENABLED', options),
    authSecret:
      getRuntimeEnvString('BETTER_AUTH_SECRET', options) ??
      getRuntimeEnvString('AUTH_SECRET', options) ??
      '',
    authBaseUrl: resolveServerAuthBaseUrl(envLike),
  };
}

export function getServerPublicEnvConfigs(
  options: RuntimeEnvOptions = {}
): PublicEnvConfigs {
  const bindings =
    options.bindings === undefined ? getCloudflareBindings() : options.bindings;

  return resolvePublicEnvConfigs({
    nextPublicTheme: getRuntimeEnvString('NEXT_PUBLIC_THEME', {
      ...options,
      bindings,
    }),
    nextPublicDefaultLocale: getRuntimeEnvString('NEXT_PUBLIC_DEFAULT_LOCALE', {
      ...options,
      bindings,
    }),
  });
}

export function isCloudflareWorkersRuntime(): boolean {
  return isCloudflareWorker;
}

export function getRuntimePlatform(): RuntimePlatform {
  return isCloudflareWorkersRuntime() ? 'cloudflare-workers' : 'node';
}
