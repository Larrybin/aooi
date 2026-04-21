import { unstable_cache } from '@/shared/lib/next-cache';
import {
  PUBLIC_CONFIGS_CACHE_TAG,
  readRuntimeSettingsFresh,
  readRuntimeSettingsSafe,
} from './settings-store';
import {
  readPublicConfigsByMode,
  type ConfigMap,
} from './public-config-projection';

const PUBLIC_CONFIGS_CACHE_REVALIDATE_SECONDS = 60 * 60;

const readPublicConfigsCached = unstable_cache(
  async (): Promise<ConfigMap> =>
    await readPublicConfigsByMode('cached', {
      readRuntimeSettingsSafeImpl: readRuntimeSettingsSafe,
      readRuntimeSettingsFreshImpl: readRuntimeSettingsFresh,
    }),
  [PUBLIC_CONFIGS_CACHE_TAG],
  {
    tags: [PUBLIC_CONFIGS_CACHE_TAG],
    revalidate: PUBLIC_CONFIGS_CACHE_REVALIDATE_SECONDS,
  }
);

export async function getPublicConfigsCached(): Promise<ConfigMap> {
  const configs = await readPublicConfigsCached();
  return { ...configs };
}

export async function getPublicConfigsFresh(): Promise<ConfigMap> {
  const configs = await readPublicConfigsByMode('fresh', {
    readRuntimeSettingsSafeImpl: readRuntimeSettingsSafe,
    readRuntimeSettingsFreshImpl: readRuntimeSettingsFresh,
  });
  return { ...configs };
}
