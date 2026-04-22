import { isEnvEnabled } from '@/config/env-contract';

export function isCloudflareLocalWorkersDevRuntime(
  env?: NodeJS.ProcessEnv
): boolean {
  return isEnvEnabled(env, 'CF_LOCAL_SMOKE_WORKERS_DEV');
}
