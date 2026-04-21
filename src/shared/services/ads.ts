import 'server-only';

import { cache } from 'react';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { readRuntimeSettingsSafe, type Configs } from '@/domains/settings/application/settings-store';
import { isDebugEnv, isProductionEnv } from '@/shared/lib/env';

import { resolveAdsRuntime, type ResolvedAdsRuntime } from './ads-runtime';
import { buildServiceFromLatestConfigs } from './config_refresh_policy';

export {
  getAdsTxtBody,
  resolveAdsRuntime,
  type ResolvedAdsRuntime,
} from './ads-runtime';

export function getAdsRuntimeWithConfigs(configs: Configs): ResolvedAdsRuntime {
  if (!isProductionEnv() && !isDebugEnv()) {
    return { enabled: false };
  }

  return resolveAdsRuntime(configs);
}

export async function getAdsRuntime(options: {
  mode?: ConfigConsistencyMode;
} = {}): Promise<ResolvedAdsRuntime> {
  return await buildServiceFromLatestConfigs(getAdsRuntimeWithConfigs, options);
}

export const getAdsRuntimeForRequest = cache(
  async (): Promise<ResolvedAdsRuntime> => {
    const { configs } = await readRuntimeSettingsSafe();
    return getAdsRuntimeWithConfigs(configs);
  }
);
