import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS,
  getCloudflareLocalSmokeConfigSeedConfigs,
  isCloudflareAdminSettingsSmokeNextCacheBypassEnabled,
  isCloudflareLocalSmokeConfigSeedEnabled,
  mergeCloudflareLocalSmokeConfigSeedConfigs,
} from './cloudflare-local-smoke-config';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
  };
}

test('isCloudflareLocalSmokeConfigSeedEnabled 仅在本地 smoke worker 模式启用', () => {
  assert.equal(isCloudflareLocalSmokeConfigSeedEnabled(createEnv()), false);
  assert.equal(
    isCloudflareLocalSmokeConfigSeedEnabled(
      createEnv({ CF_LOCAL_SMOKE_WORKERS_DEV: 'false' })
    ),
    false
  );
  assert.equal(
    isCloudflareLocalSmokeConfigSeedEnabled(
      createEnv({ CF_LOCAL_SMOKE_WORKERS_DEV: 'true' })
    ),
    true
  );
});

test('isCloudflareAdminSettingsSmokeNextCacheBypassEnabled 仅在 admin/settings smoke 专用标记下启用', () => {
  assert.equal(
    isCloudflareAdminSettingsSmokeNextCacheBypassEnabled(createEnv()),
    false
  );
  assert.equal(
    isCloudflareAdminSettingsSmokeNextCacheBypassEnabled(
      createEnv({ CF_LOCAL_SMOKE_WORKERS_DEV: 'true' })
    ),
    false
  );
  assert.equal(
    isCloudflareAdminSettingsSmokeNextCacheBypassEnabled(
      createEnv({ CF_ADMIN_SETTINGS_SMOKE_BYPASS_NEXT_CACHE: 'true' })
    ),
    true
  );
});

test('getCloudflareLocalSmokeConfigSeedConfigs 在本地 smoke worker 模式返回独立副本', () => {
  const configs = getCloudflareLocalSmokeConfigSeedConfigs(
    createEnv({ CF_LOCAL_SMOKE_WORKERS_DEV: 'true' })
  );

  assert.deepEqual(configs, CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS);
  assert.notEqual(configs, CLOUDFLARE_LOCAL_SMOKE_CONFIG_SEED_CONFIGS);
});

test('getCloudflareLocalSmokeConfigSeedConfigs 在非本地 smoke worker 模式返回空配置', () => {
  assert.deepEqual(getCloudflareLocalSmokeConfigSeedConfigs(createEnv()), {});
});

test('mergeCloudflareLocalSmokeConfigSeedConfigs 只覆盖本地 smoke 需要的公开模块开关', () => {
  assert.deepEqual(
    mergeCloudflareLocalSmokeConfigSeedConfigs(
      {
        app_name: 'Roller Rabbit',
        general_docs_enabled: 'false',
        general_ai_enabled: 'false',
        general_blog_enabled: 'false',
        custom_flag: 'kept',
      },
      createEnv({ CF_LOCAL_SMOKE_WORKERS_DEV: 'true' })
    ),
    {
      app_name: 'Roller Rabbit',
      general_docs_enabled: 'true',
      general_ai_enabled: 'true',
      general_blog_enabled: 'false',
      custom_flag: 'kept',
    }
  );
});
