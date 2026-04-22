import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveServerAuthBaseUrl } from '@/config/server-auth-base-url';

function createEnv(
  overrides: Partial<NodeJS.ProcessEnv> = {}
): NodeJS.ProcessEnv {
  return {
    ...overrides,
    NODE_ENV: overrides.NODE_ENV ?? 'test',
  };
}

test('resolveServerAuthBaseUrl 默认使用 NEXT_PUBLIC_APP_URL origin', () => {
  assert.equal(
    resolveServerAuthBaseUrl(createEnv({
      NEXT_PUBLIC_APP_URL: 'https://app.example.com/path?ignored=1',
    })),
    'https://app.example.com'
  );
});

test('resolveServerAuthBaseUrl 拒绝与 NEXT_PUBLIC_APP_URL 异源的 AUTH_URL', () => {
  assert.throws(
    () =>
      resolveServerAuthBaseUrl(createEnv({
        NEXT_PUBLIC_APP_URL: 'https://app.example.com',
        AUTH_URL: 'https://auth.example.com',
      })),
    /AUTH_URL must share the same origin as NEXT_PUBLIC_APP_URL/
  );
});

test('resolveServerAuthBaseUrl 在无 app url 时回退显式 auth url', () => {
  assert.equal(
    resolveServerAuthBaseUrl(createEnv({
      BETTER_AUTH_URL: 'http://127.0.0.1:3000/sign-in',
    })),
    'http://127.0.0.1:3000'
  );
});
