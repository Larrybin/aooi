import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';

import { isCloudflareWorker } from '@/shared/lib/env';

export type RuntimePlatform = 'node' | 'cloudflare-workers';

export type CloudflareBindings = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
} & Record<string, unknown>;

let cachedBindings: CloudflareBindings | null | undefined;

export function getCloudflareBindings(): CloudflareBindings | null {
  if (cachedBindings !== undefined) {
    return cachedBindings;
  }

  try {
    const { env } = getCloudflareContext();
    cachedBindings = env as unknown as CloudflareBindings;
    return cachedBindings;
  } catch {
    cachedBindings = null;
    return cachedBindings;
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
