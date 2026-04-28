import { isRuntimeEnvEnabled } from '@/infra/runtime/env.server';

import type { EnvLike } from '@/config/env-contract';

export const AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS = Object.freeze({
  google_auth_enabled: 'true',
  github_auth_enabled: 'true',
});

export function isAuthSpikeOAuthConfigSeedEnabled(env?: EnvLike) {
  if (env) {
    return env.AUTH_SPIKE_OAUTH_CONFIG_SEED === 'true';
  }

  return isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_CONFIG_SEED');
}

export function isAuthSpikeOAuthUpstreamMockEnabled(env?: EnvLike) {
  if (env) {
    return env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK === 'true';
  }

  return isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK');
}

export function getAuthSpikeOAuthConfigSeedConfigs(env?: EnvLike) {
  if (!isAuthSpikeOAuthConfigSeedEnabled(env)) {
    return {};
  }

  return { ...AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS };
}

export function mergeAuthSpikeOAuthConfigSeedConfigs(
  configs: Record<string, string>,
  env?: EnvLike
) {
  return {
    ...configs,
    ...getAuthSpikeOAuthConfigSeedConfigs(env),
  };
}
