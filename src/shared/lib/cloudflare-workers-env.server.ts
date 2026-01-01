import 'server-only';

import { createRequire } from 'node:module';

import { isCloudflareWorker } from '@/shared/lib/env';

export type CloudflareWorkersEnv = {
  HYPERDRIVE?: {
    connectionString?: string;
  };
} & Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

let cachedEnv: CloudflareWorkersEnv | null | undefined;

export function tryGetCloudflareWorkersEnv(): CloudflareWorkersEnv | null {
  if (cachedEnv !== undefined) {
    return cachedEnv;
  }

  try {
    const require = createRequire(import.meta.url);
    // Prevent webpack from trying to resolve the `cloudflare:` scheme at build time.
    // This module only exists in Cloudflare Workers runtime (nodejs_compat).
    const workers = require(['cloudflare', 'workers'].join(':')) as unknown;

    if (!isRecord(workers) || !('env' in workers)) {
      cachedEnv = null;
      return cachedEnv;
    }

    const env = (workers as { env?: unknown }).env;
    cachedEnv = isRecord(env) ? (env as CloudflareWorkersEnv) : null;
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
