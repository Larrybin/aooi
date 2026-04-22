import 'server-only';

import { cache } from 'react';

import type { ConfigConsistencyMode } from '@/shared/lib/config-consistency';
import { readRuntimeSettingsSafe, type Configs } from '@/domains/settings/application/settings-runtime.query';
import { isDebugEnv, isProductionEnv } from '@/shared/lib/env';

import { resolveAdsRuntime, type ResolvedAdsRuntime } from './runtime';
import { buildServiceFromLatestConfigs } from '@/infra/adapters/config-refresh-policy';

export {
  getAdsTxtBody,
  resolveAdsRuntime,
  type ResolvedAdsRuntime,
} from './runtime';

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
