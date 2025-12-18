import 'server-only';

import type { Configs } from '@/shared/models/config';
import { getAllConfigs } from '@/shared/models/config';

export type ConfigRefreshPolicy = 'always';

/**
 * Explicit refresh strategy for config-backed services.
 *
 * Current policy is intentionally "always":
 * - Keep strong consistency with admin-updated configs
 * - Match the existing behavior (previously implemented via `if (true)` blocks)
 *
 * Note: This is a code-level policy (no env) by design for this repo.
 */
export const CONFIG_REFRESH_POLICY: ConfigRefreshPolicy = 'always';

export async function buildServiceFromLatestConfigs<T>(
  buildWithConfigs: (configs: Configs) => T
): Promise<T> {
  const configs = await getAllConfigs();
  return buildWithConfigs(configs);
}

/**
 * Create a request-scoped getter for reuse within a single request/handler.
 *
 * Important: Callers must create a new getter per request to avoid cross-request caching.
 */
export function createRequestScopedServiceGetter<T>(
  buildWithConfigs: (configs: Configs) => T
) {
  let servicePromise: Promise<T> | null = null;

  return async (): Promise<T> => {
    if (!servicePromise) {
      servicePromise = buildServiceFromLatestConfigs(buildWithConfigs);
    }
    return await servicePromise;
  };
}
