import { isRuntimeEnvEnabled } from '@/infra/runtime/env.server';

export const AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS = Object.freeze({
  google_auth_enabled: 'true',
  github_auth_enabled: 'true',
});

export function isAuthSpikeOAuthConfigSeedEnabled(
  env?: NodeJS.ProcessEnv
) {
  if (env) {
    return env.AUTH_SPIKE_OAUTH_CONFIG_SEED === 'true';
  }

  return isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_CONFIG_SEED');
}

export function isAuthSpikeOAuthUpstreamMockEnabled(
  env?: NodeJS.ProcessEnv
) {
  if (env) {
    return env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK === 'true';
  }

  return isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK');
}

export function getAuthSpikeOAuthConfigSeedConfigs(
  env?: NodeJS.ProcessEnv
) {
  if (!isAuthSpikeOAuthConfigSeedEnabled(env)) {
    return {};
  }

  return { ...AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS };
}

export function mergeAuthSpikeOAuthConfigSeedConfigs(
  configs: Record<string, string>,
  env?: NodeJS.ProcessEnv
) {
  return {
    ...configs,
    ...getAuthSpikeOAuthConfigSeedConfigs(env),
  };
}
