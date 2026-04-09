import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUTH_SPIKE_OAUTH_MOCK_CONFIGS,
  getAuthSpikeOAuthMockConfigs,
  isAuthSpikeOAuthMockEnabled,
} from './auth-spike-oauth-config';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
  };
}

test('isAuthSpikeOAuthMockEnabled 仅在显式 true 时启用', () => {
  assert.equal(isAuthSpikeOAuthMockEnabled(createEnv()), false);
  assert.equal(
    isAuthSpikeOAuthMockEnabled(createEnv({ AUTH_SPIKE_OAUTH_MOCK: 'false' })),
    false
  );
  assert.equal(
    isAuthSpikeOAuthMockEnabled(createEnv({ AUTH_SPIKE_OAUTH_MOCK: 'true' })),
    true
  );
});

test('getAuthSpikeOAuthMockConfigs 在 mock 模式返回独立副本', () => {
  const configs = getAuthSpikeOAuthMockConfigs(
    createEnv({ AUTH_SPIKE_OAUTH_MOCK: 'true' })
  );

  assert.deepEqual(configs, AUTH_SPIKE_OAUTH_MOCK_CONFIGS);
  assert.notEqual(configs, AUTH_SPIKE_OAUTH_MOCK_CONFIGS);
});

test('getAuthSpikeOAuthMockConfigs 在非 mock 模式返回空配置', () => {
  assert.deepEqual(getAuthSpikeOAuthMockConfigs(createEnv()), {});
});
