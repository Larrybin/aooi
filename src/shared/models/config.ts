import 'server-only';

import { sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { config } from '@/config/db/schema';
import { mergeAuthSpikeOAuthConfigSeedConfigs } from '@/shared/lib/auth-spike-oauth-config';
import { mergeCloudflareLocalSmokeConfigSeedConfigs } from '@/shared/lib/cloudflare-local-smoke-config';
import { logger } from '@/shared/lib/logger.server';
import { unstable_cache } from '@/shared/lib/next-cache';
import {
  getServerPublicEnvConfigs,
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
} from '@/shared/lib/runtime/env.server';
import { readPublicConfigsByMode } from '@/shared/models/public-configs';
import { type KnownSettingKey } from '@/shared/services/settings/registry';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

export type RuntimeConfigKey =
  | 'theme'
  | 'locale'
  | 'default_locale'

// Known keys help avoid cross-module typos; keep in sync with env/db usage
export type KnownConfigKey = KnownSettingKey | RuntimeConfigKey;

export function getString(
  configs: Configs,
  key: KnownConfigKey,
  fallback = ''
) {
  const value = configs[key];
  return value ?? fallback;
}

export function getBool(configs: Configs, key: KnownConfigKey): boolean {
  return configs[key] === 'true';
}

export const CONFIGS_CACHE_TAG = 'db-configs';
export const PUBLIC_CONFIGS_CACHE_TAG = 'public-configs';
const CONFIGS_CACHE_REVALIDATE_SECONDS = 60;
const PUBLIC_CONFIGS_CACHE_REVALIDATE_SECONDS = 60 * 60;

export async function saveConfigs(configs: Record<string, string>) {
  const entries = Object.entries(configs);
  if (entries.length === 0) return [];

  const values = entries.map(([name, value]) => ({ name, value }));

  const result = await db()
    .insert(config)
    .values(values)
    .onConflictDoUpdate({
      target: config.name,
      set: { value: sql`excluded.value` },
    })
    .returning();

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  const [result] = await db().insert(config).values(newConfig).returning();

  return result;
}

async function getConfigsFromDb(): Promise<Configs> {
  const configs: Record<string, string> = {};
  const runtimeEnv = getServerRuntimeEnv();

  if (!runtimeEnv.databaseUrl && !isCloudflareWorkersRuntime()) {
    return mergeAuthSpikeOAuthConfigSeedConfigs(configs);
  }

  const result = await db().select().from(config);

  for (const config of result) {
    configs[config.name] = config.value ?? '';
  }

  return mergeCloudflareLocalSmokeConfigSeedConfigs(
    mergeAuthSpikeOAuthConfigSeedConfigs(configs)
  );
}

export async function getConfigsFresh(): Promise<Configs> {
  const configs = await getConfigsFromDb();
  return { ...configs };
}

const getConfigsCached = unstable_cache(
  async (): Promise<Configs> => await getConfigsFromDb(),
  [CONFIGS_CACHE_TAG],
  {
    tags: [CONFIGS_CACHE_TAG],
    revalidate: CONFIGS_CACHE_REVALIDATE_SECONDS,
  }
);

export async function getConfigs(): Promise<Configs> {
  const configs = await getConfigsCached();
  return { ...configs };
}

export async function getConfigsSafe(): Promise<{
  configs: Configs;
  error?: Error;
}> {
  try {
    const configs = await getConfigs();
    return { configs };
  } catch (e: unknown) {
    const error =
      e instanceof Error ? e : new Error(`getConfigs failed: ${String(e)}`);
    logger.error('[config] getConfigs failed', { error });
    return { configs: {}, error };
  }
}

export async function getAllConfigsCached(): Promise<Configs> {
  const dbConfigs = await getConfigs();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();

  // DB is allowed to override env for compatibility (app_url/app_name/locale...)
  const configs = {
    ...serverPublicEnvConfigs,
    ...dbConfigs,
  };

  return configs;
}

export async function getAllConfigsFresh(): Promise<Configs> {
  const dbConfigs = await getConfigsFresh();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();

  return {
    ...serverPublicEnvConfigs,
    ...dbConfigs,
  };
}

export async function getAllConfigsSafe(): Promise<{
  configs: Configs;
  error?: Error;
}> {
  const { configs: dbConfigs, error } = await getConfigsSafe();
  const serverPublicEnvConfigs = getServerPublicEnvConfigs();

  return {
    configs: {
      ...serverPublicEnvConfigs,
      ...dbConfigs,
    },
    error,
  };
}

const readPublicConfigsCached = unstable_cache(
  async (): Promise<Configs> =>
    await readPublicConfigsByMode('cached', {
      getAllConfigsSafeImpl: getAllConfigsSafe,
      getAllConfigsFreshImpl: getAllConfigsFresh,
    }),
  [PUBLIC_CONFIGS_CACHE_TAG],
  {
    tags: [PUBLIC_CONFIGS_CACHE_TAG],
    revalidate: PUBLIC_CONFIGS_CACHE_REVALIDATE_SECONDS,
  }
);

export async function getPublicConfigsCached(): Promise<Configs> {
  const configs = await readPublicConfigsCached();
  return { ...configs };
}

export async function getPublicConfigsFresh(): Promise<Configs> {
  const configs = await readPublicConfigsByMode('fresh', {
    getAllConfigsSafeImpl: getAllConfigsSafe,
    getAllConfigsFreshImpl: getAllConfigsFresh,
  });
  return { ...configs };
}
