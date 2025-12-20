import 'server-only';

import { db } from '@/core/db';
import { envConfigs } from '@/config';
import { serverEnv } from '@/config/server';
import { config } from '@/config/db/schema';
import { publicSettingNames } from '@/shared/constants/public-setting-names';
import { logger } from '@/shared/lib/logger.server';

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
export type UpdateConfig = Partial<Omit<NewConfig, 'name'>>;

export type Configs = Record<string, string>;

export async function saveConfigs(configs: Record<string, string>) {
  const result = await db().transaction(async (tx) => {
    const configEntries = Object.entries(configs);
    const results = [];

    for (const [name, configValue] of configEntries) {
      const [upsertResult] = await tx
        .insert(config)
        .values({ name, value: configValue })
        .onConflictDoUpdate({
          target: config.name,
          set: { value: configValue },
        })
        .returning();

      results.push(upsertResult);
    }

    return results;
  });

  return result;
}

export async function addConfig(newConfig: NewConfig) {
  const [result] = await db().insert(config).values(newConfig).returning();

  return result;
}

export async function getConfigs(): Promise<Configs> {
  const configs: Record<string, string> = {};

  if (!serverEnv.databaseUrl) {
    return configs;
  }

  const result = await db().select().from(config);

  for (const config of result) {
    configs[config.name] = config.value ?? '';
  }

  return configs;
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

  const configs = {
    ...envConfigs,
    ...dbConfigs,
  };

  return configs;
}

export async function getPublicConfigs(): Promise<Configs> {
  const dbConfigs = await getConfigs();

  const publicConfigs: Record<string, string> = {};

  // get public configs from db
  for (const key in dbConfigs) {
    if (publicSettingNames.includes(key)) {
      publicConfigs[key] = dbConfigs[key];
    }
  }

  const configs = {
    ...publicConfigs,
  };

  return configs;
}
