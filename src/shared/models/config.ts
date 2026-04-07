import 'server-only';

import { sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { config } from '@/config/db/schema';
import { serverEnv } from '@/config/server';
import { PUBLIC_SETTING_NAMES } from '@/shared/constants/public-setting-names';
import { logger } from '@/shared/lib/logger.server';
import { unstable_cache } from '@/shared/lib/next-cache';
import { isCloudflareWorkersRuntime } from '@/shared/lib/runtime/env.server';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

// Known keys help avoid cross-module typos; keep in sync with env/db usage
export type KnownConfigKey =
  | (typeof PUBLIC_SETTING_NAMES)[number]
  | 'theme'
  | 'locale'
  | 'default_locale'
  | 'creem_product_ids'
  | 'default_payment_provider';

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
const CONFIGS_CACHE_REVALIDATE_SECONDS = 60;

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

  if (!serverEnv.databaseUrl && !isCloudflareWorkersRuntime()) {
    return configs;
  }

  const result = await db().select().from(config);

  for (const config of result) {
    configs[config.name] = config.value ?? '';
  }

  return configs;
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

export async function getAllConfigs(): Promise<Configs> {
  const dbConfigs = await getConfigs();

  // DB is allowed to override env for compatibility (app_url/app_name/locale...)
  const configs = {
    ...envConfigs,
    ...dbConfigs,
  };

  return configs;
}

export async function getAllConfigsSafe(): Promise<{
  configs: Configs;
  error?: Error;
}> {
  const { configs: dbConfigs, error } = await getConfigsSafe();

  return {
    configs: {
      ...envConfigs,
      ...dbConfigs,
    },
    error,
  };
}

export async function getPublicConfigs(): Promise<Configs> {
  const { configs: allConfigs } = await getAllConfigsSafe();

  const publicConfigs: Record<string, string> = {};

  for (const key of PUBLIC_SETTING_NAMES) {
    const value = allConfigs[key];
    if (value !== undefined) {
      publicConfigs[key] = value;
    }
  }

  return publicConfigs;
}
