import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/site';
import { resolveServerAuthBaseUrl } from '@/config/server-auth-base-url';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
  };
}

test('resolveServerAuthBaseUrl 默认使用 site.brand.appUrl origin', () => {
  assert.equal(resolveServerAuthBaseUrl(createEnv()), site.brand.appUrl);
});

test('resolveServerAuthBaseUrl 拒绝与 site.brand.appUrl 异源的 AUTH_URL', () => {
  assert.throws(
    () =>
      resolveServerAuthBaseUrl(createEnv({
        AUTH_URL: 'https://auth.example.com',
      })),
    /AUTH_URL must share the same origin as site\.brand\.appUrl/
  );
});

test('resolveServerAuthBaseUrl 接受与 site.brand.appUrl 同源的 BETTER_AUTH_URL', () => {
  assert.equal(
    resolveServerAuthBaseUrl(createEnv({
      BETTER_AUTH_URL: `${site.brand.appUrl}/sign-in`,
    })),
    site.brand.appUrl
  );
});
