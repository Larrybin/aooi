import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS,
  getAuthSpikeOAuthConfigSeedConfigs,
  isAuthSpikeOAuthConfigSeedEnabled,
  isAuthSpikeOAuthUpstreamMockEnabled,
  mergeAuthSpikeOAuthConfigSeedConfigs,
} from './oauth-spike-config';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
  };
}

test('isAuthSpikeOAuthConfigSeedEnabled 仅在显式 true 时启用', () => {
  assert.equal(isAuthSpikeOAuthConfigSeedEnabled(createEnv()), false);
  assert.equal(
    isAuthSpikeOAuthConfigSeedEnabled(
      createEnv({ AUTH_SPIKE_OAUTH_CONFIG_SEED: 'false' })
    ),
    false
  );
  assert.equal(
    isAuthSpikeOAuthConfigSeedEnabled(
      createEnv({ AUTH_SPIKE_OAUTH_CONFIG_SEED: 'true' })
    ),
    true
  );
});

test('isAuthSpikeOAuthUpstreamMockEnabled 仅在显式 true 时启用', () => {
  assert.equal(isAuthSpikeOAuthUpstreamMockEnabled(createEnv()), false);
  assert.equal(
    isAuthSpikeOAuthUpstreamMockEnabled(
      createEnv({ AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'false' })
    ),
    false
  );
  assert.equal(
    isAuthSpikeOAuthUpstreamMockEnabled(
      createEnv({ AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true' })
    ),
    true
  );
});

test('isAuthSpikeOAuthUpstreamMockEnabled 默认读取当前 runtime env', () => {
  const previous = process.env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK;
  process.env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK = 'true';

  try {
    assert.equal(isAuthSpikeOAuthUpstreamMockEnabled(), true);
  } finally {
    if (previous === undefined) {
      delete process.env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK;
    } else {
      process.env.AUTH_SPIKE_OAUTH_UPSTREAM_MOCK = previous;
    }
  }
});

test('getAuthSpikeOAuthConfigSeedConfigs 在 config seed 模式返回独立副本', () => {
  const configs = getAuthSpikeOAuthConfigSeedConfigs(
    createEnv({ AUTH_SPIKE_OAUTH_CONFIG_SEED: 'true' })
  );

  assert.deepEqual(configs, AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS);
  assert.notEqual(configs, AUTH_SPIKE_OAUTH_CONFIG_SEED_CONFIGS);
});

test('getAuthSpikeOAuthConfigSeedConfigs 在非 config seed 模式返回空配置', () => {
  assert.deepEqual(getAuthSpikeOAuthConfigSeedConfigs(createEnv()), {});
});

test('mergeAuthSpikeOAuthConfigSeedConfigs 只覆盖 auth 相关 key，保留其余配置', () => {
  assert.deepEqual(
    mergeAuthSpikeOAuthConfigSeedConfigs(
      {
        google_client_id: 'db-google-client-id',
        custom_flag: 'kept',
      },
      createEnv({ AUTH_SPIKE_OAUTH_CONFIG_SEED: 'true' })
    ),
    {
      google_auth_enabled: 'true',
      google_client_id: 'oauth-spike-google-client-id',
      google_client_secret: 'oauth-spike-google-client-secret',
      github_auth_enabled: 'true',
      github_client_id: 'oauth-spike-github-client-id',
      github_client_secret: 'oauth-spike-github-client-secret',
      custom_flag: 'kept',
    }
  );
});
