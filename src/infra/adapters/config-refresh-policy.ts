import 'server-only';

import {
  readSettingsCached,
  readSettingsFresh,
  type Configs,
} from '@/domains/settings/application/settings-store';
import { readServiceConfigsByMode } from '@/infra/adapters/config-read-mode';

import { type ConfigConsistencyMode } from '@/shared/lib/config-consistency';

export type ConfigRefreshPolicy = 'cached';

/**
 * Explicit refresh strategy for config-backed services.
 *
 * Current policy is intentionally "cached":
 * - Preserve production query budget for config-backed services
 * - Keep strong consistency opt-in limited to local Cloudflare smoke harness
 *
 * Note: This is a code-level policy (no env) by design for this repo.
 */
export const CONFIG_REFRESH_POLICY: ConfigRefreshPolicy = 'cached';

export async function buildServiceFromLatestConfigs<T>(
  buildWithConfigs: (configs: Configs) => T | Promise<T>,
  options: {
    mode?: ConfigConsistencyMode;
  } = {}
): Promise<T> {
  const configs = await readServiceConfigsByMode(
    options.mode ?? CONFIG_REFRESH_POLICY,
    {
      readSettingsCachedImpl: readSettingsCached,
      readSettingsFreshImpl: readSettingsFresh,
    }
  );
  return await buildWithConfigs(configs);
}

/**
 * Create a request-scoped getter for reuse within a single request/handler.
 *
 * Important: Callers must create a new getter per request to avoid cross-request caching.
 */
export function createRequestScopedServiceGetter<T>(
  buildWithConfigs: (configs: Configs) => T | Promise<T>,
  options: {
    mode?: ConfigConsistencyMode;
  } = {}
) {
  let servicePromise: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (!servicePromise) {
      servicePromise = buildServiceFromLatestConfigs(buildWithConfigs, options);
    }
    return await servicePromise;
  };
}
