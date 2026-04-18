export const CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS = Object.freeze({
  general_docs_enabled: 'true',
  general_ai_enabled: 'true',
});

export function isCloudflareAdminSettingsSmokeNextCacheBypassEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.CF_ADMIN_SETTINGS_SMOKE_BYPASS_NEXT_CACHE === 'true';
}

export function isCloudflareLocalSmokeConfigSeedEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.CF_LOCAL_SMOKE_WORKERS_DEV === 'true';
}

export function getCloudflareLocalSmokeConfigSeedConfigs(
  env: NodeJS.ProcessEnv = process.env
) {
  if (!isCloudflareLocalSmokeConfigSeedEnabled(env)) {
    return {};
  }

  return { ...CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS };
}

export function mergeCloudflareLocalSmokeConfigSeedConfigs(
  configs: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env
) {
  return {
    ...configs,
    ...getCloudflareLocalSmokeConfigSeedConfigs(env),
  };
}
