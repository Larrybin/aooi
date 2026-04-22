import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeAuthSpikeRedirectLocationValue,
  resolveAuthSpikeRedirectRequestUrl,
  toRelativeSameOriginAuthSpikeRedirectLocationValue,
} from './auth-spike-redirect';

test('resolveAuthSpikeRedirectRequestUrl 用请求头 host 还原本地 preview 真实 origin', () => {
  const request = new Request('http://localhost/api/auth/callback/google?code=1', {
    headers: {
      host: 'localhost:8787',
    },
  });

  assert.equal(
    resolveAuthSpikeRedirectRequestUrl(request),
    'http://localhost:8787/api/auth/callback/google?code=1'
  );
});

test('resolveAuthSpikeRedirectRequestUrl 在 split worker 丢失端口时回退到 runtime preview origin', () => {
  const request = new Request('http://localhost/api/auth/callback/google?code=1', {
    headers: {
      host: 'localhost',
      'x-forwarded-host': 'localhost',
      'x-forwarded-proto': 'http',
    },
  });

  assert.equal(
    resolveAuthSpikeRedirectRequestUrl(request, {
      runtimeBaseUrl: 'http://localhost:8787',
    }),
    'http://localhost:8787/api/auth/callback/google?code=1'
  );
});

test('normalizeAuthSpikeRedirectLocationValue 修正本地重复端口的非法 redirect URL', () => {
  assert.equal(
    normalizeAuthSpikeRedirectLocationValue(
      'http://localhost:8787:8787/api/auth/error?error=access_denied',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/api/auth/error?error=access_denied'
  );
});

test('normalizeAuthSpikeRedirectLocationValue 修正本地重复端口的 sign-in redirect URL', () => {
  assert.equal(
    normalizeAuthSpikeRedirectLocationValue(
      'http://localhost:8787:8787/sign-in?callbackUrl=%2Fsettings%2Fprofile&error=access_denied',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/sign-in?callbackUrl=%2Fsettings%2Fprofile&error=access_denied'
  );
});

test('normalizeAuthSpikeRedirectLocationValue 会压平多层重复端口的 redirect URL', () => {
  assert.equal(
    normalizeAuthSpikeRedirectLocationValue(
      'http://localhost:8787:8787:8787/api/auth/error?error=please_restart_the_process',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/api/auth/error?error=please_restart_the_process'
  );
});

test('normalizeAuthSpikeRedirectLocationValue 保留同源 redirect URL', () => {
  assert.equal(
    normalizeAuthSpikeRedirectLocationValue(
      'http://localhost:8787/api/auth/error?error=access_denied',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/api/auth/error?error=access_denied'
  );
});

test('toRelativeSameOriginAuthSpikeRedirectLocationValue 把同源绝对 redirect 改写成相对路径', () => {
  assert.equal(
    toRelativeSameOriginAuthSpikeRedirectLocationValue(
      'http://localhost:8787/api/auth/error?error=please_restart_the_process',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    '/api/auth/error?error=please_restart_the_process'
  );
});

test('normalizeAuthSpikeRedirectLocationValue 把异源 redirect URL 归一到当前请求 origin', () => {
  assert.equal(
    normalizeAuthSpikeRedirectLocationValue(
      'https://example.com/api/auth/error?error=access_denied',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/api/auth/error?error=access_denied'
  );
});
