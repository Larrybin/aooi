import { isRuntimeEnvEnabled } from '@/shared/lib/runtime/env.server';

export const CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS = Object.freeze({
  general_docs_enabled: 'true',
  general_ai_enabled: 'true',
});

export function isCloudflareAdminSettingsSmokeNextCacheBypassEnabled(
  env?: NodeJS.ProcessEnv
) {
  if (env) {
    return env.CF_ADMIN_SETTINGS_SMOKE_BYPASS_NEXT_CACHE === 'true';
  }

  return isRuntimeEnvEnabled('CF_ADMIN_SETTINGS_SMOKE_BYPASS_NEXT_CACHE');
}

export function isCloudflareLocalSmokeConfigSeedEnabled(
  env?: NodeJS.ProcessEnv
) {
  if (env) {
    return env.CF_LOCAL_SMOKE_WORKERS_DEV === 'true';
  }

  return isRuntimeEnvEnabled('CF_LOCAL_SMOKE_WORKERS_DEV');
}

export function getCloudflareLocalSmokeConfigSeedConfigs(
  env?: NodeJS.ProcessEnv
) {
  if (!isCloudflareLocalSmokeConfigSeedEnabled(env)) {
    return {};
  }

  return { ...CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS };
}

export function mergeCloudflareLocalSmokeConfigSeedConfigs(
  configs: Record<string, string>,
  env?: NodeJS.ProcessEnv
) {
  return {
    ...configs,
    ...getCloudflareLocalSmokeConfigSeedConfigs(env),
  };
}
