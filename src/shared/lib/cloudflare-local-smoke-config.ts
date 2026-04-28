import { isRuntimeEnvEnabled } from '@/infra/runtime/env.server';

import type { EnvLike } from '@/config/env-contract';

export const CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS = Object.freeze({
  general_ai_enabled: 'true',
});

export function isCloudflareLocalSmokeConfigSeedEnabled(env?: EnvLike) {
  if (env) {
    return env.CF_LOCAL_SMOKE_WORKERS_DEV === 'true';
  }

  return isRuntimeEnvEnabled('CF_LOCAL_SMOKE_WORKERS_DEV');
}

export function getCloudflareLocalSmokeConfigSeedConfigs(env?: EnvLike) {
  if (!isCloudflareLocalSmokeConfigSeedEnabled(env)) {
    return {};
  }

  return { ...CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS };
}

export function mergeCloudflareLocalSmokeConfigSeedConfigs(
  configs: Record<string, string>,
  env?: EnvLike
) {
  return {
    ...configs,
    ...getCloudflareLocalSmokeConfigSeedConfigs(env),
  };
}
