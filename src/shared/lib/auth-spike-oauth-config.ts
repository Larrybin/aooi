export const AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS = Object.freeze({
  google_auth_enabled: 'true',
  google_client_id: 'oauth-spike-google-client-id',
  google_client_secret: 'oauth-spike-google-client-secret',
  github_auth_enabled: 'true',
  github_client_id: 'oauth-spike-github-client-id',
  github_client_secret: 'oauth-spike-github-client-secret',
});

export function isAuthSpikeOAuthConfigSeedEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.AUTH_SPIKE_OAUTH_CONFIG_SEED === 'true';
}

export function isAuthSpikeOAuthUpstreamMockEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK === 'true';
}

export function getAuthSpikeOAuthConfigSeedConfigs(
  env: NodeJS.ProcessEnv = process.env
) {
  if (!isAuthSpikeOAuthConfigSeedEnabled(env)) {
    return {};
  }

  return { ...AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS };
}

export function mergeAuthSpikeOAuthConfigSeedConfigs(
  configs: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env
) {
  return {
    ...configs,
    ...getAuthSpikeOAuthConfigSeedConfigs(env),
  };
}
