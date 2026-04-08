export const AUTH_SPIKE_OAUTH_MOCK_CONFIGS = Object.freeze({
  google_auth_enabled: 'true',
  google_client_id: 'oauth-spike-google-client-id',
  google_client_secret: 'oauth-spike-google-client-secret',
  github_auth_enabled: 'true',
  github_client_id: 'oauth-spike-github-client-id',
  github_client_secret: 'oauth-spike-github-client-secret',
});

export function isAuthSpikeOAuthMockEnabled(
  env: NodeJS.ProcessEnv = process.env
) {
  return env.AUTH_SPIKE_OAUTH_MOCK === 'true';
}

export function getAuthSpikeOAuthMockConfigs(
  env: NodeJS.ProcessEnv = process.env
) {
  if (!isAuthSpikeOAuthMockEnabled(env)) {
    return {};
  }

  return { ...AUTH_SPIKE_OAUTH_MOCK_CONFIGS };
}
