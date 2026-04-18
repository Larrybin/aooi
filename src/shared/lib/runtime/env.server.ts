import { getCloudflareContext } from '@opennextjs/cloudflare';

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
} & Record<string, unknown>;

export function getCloudflareBindings(): CloudflareBindings | null {
  try {
    const { env } = getCloudflareContext();
    return { ...env };
  } catch {
    return null;
  }
}

export function isCloudflareWorkersRuntime(): boolean {
  if (isCloudflareWorker) {
    return true;
  }

  return getCloudflareBindings() !== null;
}

export function getRuntimePlatform(): RuntimePlatform {
  return isCloudflareWorkersRuntime() ? 'cloudflare-workers' : 'node';
}
