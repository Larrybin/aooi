import { isRuntimeEnvEnabled } from '@/infra/runtime/env.server';
import { isCloudflareLocalWorkersDevRuntime } from '@/infra/runtime/runtime-mode';

import type { EnvLike } from '@/config/env-contract';

export const CONFIG_CONSISTENCY_HEADER = 'x-aooi-config-consistency';
export const CONFIG_CONSISTENCY_FRESH_VALUE = 'fresh';

export type ConfigConsistencyMode = 'cached' | 'fresh';

export function resolveConfigConsistencyMode(
  request: Pick<Request, 'headers'>,
  env?: EnvLike
): ConfigConsistencyMode {
  const isLocalSmokeRuntime = env
    ? isCloudflareLocalWorkersDevRuntime(env)
    : isRuntimeEnvEnabled('CF_LOCAL_SMOKE_WORKERS_DEV');

  if (!isLocalSmokeRuntime) {
    return 'cached';
  }

  return request.headers
    .get(CONFIG_CONSISTENCY_HEADER)
    ?.trim()
    .toLowerCase() === CONFIG_CONSISTENCY_FRESH_VALUE
    ? 'fresh'
    : 'cached';
}
