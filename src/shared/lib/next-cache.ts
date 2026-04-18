import 'server-only';

import { unstable_cache as nextUnstableCache } from 'next/cache';

import { isCloudflareAdminSettingsSmokeNextCacheBypassEnabled } from '@/shared/lib/cloudflare-local-smoke-config';

type CacheCallback = (...args: any[]) => Promise<any>;

export function unstable_cache<T extends CacheCallback>(
  callback: T,
  keyParts?: string[],
  options?: Parameters<typeof nextUnstableCache>[2]
) {
  if (isCloudflareAdminSettingsSmokeNextCacheBypassEnabled()) {
    return (async (...args: Parameters<T>) => await callback(...args)) as T;
  }

  return nextUnstableCache(callback, keyParts, options) as T;
}
