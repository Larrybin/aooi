import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';

import { isCloudflareWorker } from '@/shared/lib/env';

export type CloudflareWorkersEnv = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
} & Record<string, unknown>;

let cachedEnv: CloudflareWorkersEnv | null | undefined;

export function tryGetCloudflareWorkersEnv(): CloudflareWorkersEnv | null {
  if (cachedEnv !== undefined) {
    return cachedEnv;
  }

  try {
    const { env } = getCloudflareContext();
    cachedEnv = env as unknown as CloudflareWorkersEnv;
    return cachedEnv;
  } catch {
    cachedEnv = null;
    return cachedEnv;
  }
}

export function isCloudflareWorkersRuntime(): boolean {
  if (isCloudflareWorker) return true;
  return tryGetCloudflareWorkersEnv() !== null;
}
