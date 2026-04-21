import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSocialAuthorizationUrl } from './social-authorization-url';

test('normalizeSocialAuthorizationUrl 会把 redirect_uri 收敛到当前 preview origin', () => {
  const authorizationUrl = normalizeSocialAuthorizationUrl({
    authorizationUrl:
      'https://accounts.google.com/o/oauth2/auth?client_id=test-client&redirect_uri=http%3A%2F%2Fmamamiya.pdfreprinting.net%2Fapi%2Fauth%2Fcallback%2Fgoogle&state=test-state',
    provider: 'google',
    runtimeOrigin: 'http://localhost:8787',
  });

  assert.equal(
    new URL(authorizationUrl).searchParams.get('redirect_uri'),
    'http://localhost:8787/api/auth/callback/google'
  );
});

test('normalizeSocialAuthorizationUrl 不改写已经匹配当前 origin 的 redirect_uri', () => {
  const originalAuthorizationUrl =
    'https://github.com/login/oauth/authorize?client_id=test-client&redirect_uri=http%3A%2F%2Flocalhost%3A8787%2Fapi%2Fauth%2Fcallback%2Fgithub&state=test-state';

  assert.equal(
    normalizeSocialAuthorizationUrl({
      authorizationUrl: originalAuthorizationUrl,
      provider: 'github',
      runtimeOrigin: 'http://localhost:8787',
    }),
    originalAuthorizationUrl
  );
});

test('normalizeSocialAuthorizationUrl 不改写非 provider callback 的 redirect_uri', () => {
  const originalAuthorizationUrl =
    'https://github.com/login/oauth/authorize?client_id=test-client&redirect_uri=https%3A%2F%2Fexample.com%2Fwelcome&state=test-state';

  assert.equal(
    normalizeSocialAuthorizationUrl({
      authorizationUrl: originalAuthorizationUrl,
      provider: 'github',
      runtimeOrigin: 'http://localhost:8787',
    }),
    originalAuthorizationUrl
  );
});
