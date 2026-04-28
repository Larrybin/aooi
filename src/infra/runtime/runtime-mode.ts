import { isEnvEnabled, type EnvLike } from '@/config/env-contract';

export function isCloudflareLocalWorkersDevRuntime(env?: EnvLike): boolean {
  return isEnvEnabled(env, 'CF_LOCAL_SMOKE_WORKERS_DEV');
}
