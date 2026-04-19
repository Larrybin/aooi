import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRuntimeEnvString,
  getServerPublicEnvConfigs,
  getServerRuntimeEnv,
  isCloudflareWorkersRuntime,
  isRuntimeEnvEnabled,
  type CloudflareBindings,
} from './env.server';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    NODE_ENV: overrides.NODE_ENV ?? 'test',
    ...overrides,
  };
}

test('getRuntimeEnvString 优先读取 Cloudflare bindings 中的字符串值', () => {
  assert.equal(
    getRuntimeEnvString('NEXT_PUBLIC_APP_URL', {
      env: createEnv({ NEXT_PUBLIC_APP_URL: 'https://env.example.com' }),
      bindings: {
        NEXT_PUBLIC_APP_URL: 'https://binding.example.com',
      } as CloudflareBindings,
    }),
    'https://binding.example.com'
  );
});

test('getRuntimeEnvString 在无 bindings 值时回退到 process env', () => {
  assert.equal(
    getRuntimeEnvString('NEXT_PUBLIC_APP_URL', {
      env: createEnv({ NEXT_PUBLIC_APP_URL: 'https://env.example.com' }),
      bindings: null,
    }),
    'https://env.example.com'
  );
});

test('isRuntimeEnvEnabled 仅在显式 true 时返回 true', () => {
  assert.equal(
    isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK', {
      env: createEnv({ AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'false' }),
      bindings: null,
    }),
    false
  );
  assert.equal(
    isRuntimeEnvEnabled('AUTH_SPIKE_OAUTH_UPSTREAM_MOCK', {
      env: createEnv({ AUTH_SPIKE_OAUTH_UPSTREAM_MOCK: 'true' }),
      bindings: null,
    }),
    true
  );
});

test('getServerPublicEnvConfigs 优先使用 runtime bindings 的公开配置', () => {
  const configs = getServerPublicEnvConfigs({
    env: createEnv({
      NEXT_PUBLIC_APP_URL: 'https://env.example.com',
      NEXT_PUBLIC_APP_NAME: 'Env Name',
      NEXT_PUBLIC_THEME: 'env-theme',
      NEXT_PUBLIC_DEFAULT_LOCALE: 'zh',
    }),
    bindings: {
      NEXT_PUBLIC_APP_URL: 'https://binding.example.com',
      NEXT_PUBLIC_APP_NAME: 'Binding Name',
      NEXT_PUBLIC_APP_LOGO: '/binding-logo.png',
      NEXT_PUBLIC_APP_FAVICON: '/binding-favicon.ico',
      NEXT_PUBLIC_APP_PREVIEW_IMAGE: '/binding-preview.png',
      NEXT_PUBLIC_THEME: 'binding-theme',
      NEXT_PUBLIC_DEFAULT_LOCALE: 'en',
    } as CloudflareBindings,
  });

  assert.deepEqual(configs, {
    app_url: 'https://binding.example.com',
    app_name: 'Binding Name',
    app_logo: '/binding-logo.png',
    app_favicon: '/binding-favicon.ico',
    app_og_image: '/binding-preview.png',
    theme: 'binding-theme',
    locale: 'en',
  });
});

test('getServerPublicEnvConfigs 在生产 build 阶段无 bindings 时沿用构建期回退语义', () => {
  const configs = getServerPublicEnvConfigs({
    env: createEnv({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build',
    }),
    bindings: null,
  });

  assert.equal(configs.app_url, 'http://localhost:3000');
});

test('getServerPublicEnvConfigs 在生产非 build 阶段缺失 app url 时仍抛错', () => {
  assert.throws(
    () =>
      getServerPublicEnvConfigs({
        env: createEnv({
          NODE_ENV: 'production',
        }),
        bindings: null,
      }),
    /NEXT_PUBLIC_APP_URL is required in production/
  );
});

test('getServerRuntimeEnv 会从 runtime env 解析数据库和 auth 配置', () => {
  const runtimeEnv = getServerRuntimeEnv({
    env: createEnv({
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgres://env-db',
      DB_SINGLETON_ENABLED: 'false',
      AUTH_SECRET: 'env-secret',
      NEXT_PUBLIC_APP_URL: 'https://env.example.com',
    }),
    bindings: {
      DATABASE_PROVIDER: 'postgresql',
      DATABASE_URL: 'postgres://binding-db',
      DB_SINGLETON_ENABLED: 'true',
      BETTER_AUTH_SECRET: 'binding-secret',
      NEXT_PUBLIC_APP_URL: 'https://binding.example.com',
    } as CloudflareBindings,
  });

  assert.deepEqual(runtimeEnv, {
    databaseProvider: 'postgresql',
    databaseUrl: 'postgres://binding-db',
    dbSingletonEnabled: true,
    authSecret: 'binding-secret',
    authBaseUrl: 'https://binding.example.com',
  });
});

test('Node 运行时不会因为存在 Cloudflare bindings 误判为 Workers', () => {
  assert.equal(isCloudflareWorkersRuntime(), false);
});
