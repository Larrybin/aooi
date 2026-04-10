import 'server-only';

import { cache } from 'react';

import { getAllConfigsSafe, type Configs } from '@/shared/models/config';

import { resolveAdsRuntime, type ResolvedAdsRuntime } from './ads-runtime';
import { buildServiceFromLatestConfigs } from './config_refresh_policy';

export {
  getAdsTxtBody,
  resolveAdsRuntime,
  type ResolvedAdsRuntime,
} from './ads-runtime';

export function getAdsRuntimeWithConfigs(configs: Configs): ResolvedAdsRuntime {
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_DEBUG !== 'true'
  ) {
    return { enabled: false };
  }

  return resolveAdsRuntime(configs);
}

export async function getAdsRuntime(): Promise<ResolvedAdsRuntime> {
  return await buildServiceFromLatestConfigs(getAdsRuntimeWithConfigs);
}

export const getAdsRuntimeForRequest = cache(
  async (): Promise<ResolvedAdsRuntime> => {
    const { configs } = await getAllConfigsSafe();
    return getAdsRuntimeWithConfigs(configs);
  }
);
