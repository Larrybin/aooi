import assert from 'node:assert/strict';
import test from 'node:test';

import { isTerminalAuthErrorUrl } from '../../src/testing/auth-spike.browser';
import { resolveStrictSameOriginRedirectLocation } from '../../src/testing/oauth-spike.browser';
import { terminalAuthErrorUrlCases } from './auth-error-url-cases';

test('resolveStrictSameOriginRedirectLocation 接受同源相对路径', () => {
  assert.equal(
    resolveStrictSameOriginRedirectLocation(
      '/sign-in?error=access_denied',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/sign-in?error=access_denied'
  );
});

test('resolveStrictSameOriginRedirectLocation 接受同源绝对 URL', () => {
  assert.equal(
    resolveStrictSameOriginRedirectLocation(
      'http://localhost:8787/sign-in?error=access_denied',
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    'http://localhost:8787/sign-in?error=access_denied'
  );
});

test('resolveStrictSameOriginRedirectLocation 拒绝异源绝对 URL', () => {
  assert.throws(
    () =>
      resolveStrictSameOriginRedirectLocation(
        'https://example.com/api/auth/error?error=access_denied',
        'http://localhost:8787/api/auth/callback/google?error=access_denied'
      ),
    /cross-origin location/
  );
});

test('resolveStrictSameOriginRedirectLocation 拒绝畸形重复端口 URL', () => {
  assert.throws(
    () =>
      resolveStrictSameOriginRedirectLocation(
        'http://localhost:8787:8787/api/auth/error?error=access_denied',
        'http://localhost:8787/api/auth/callback/google?error=access_denied'
      ),
    /invalid location/
  );
});

test('isTerminalAuthErrorUrl 继续只接受最终错误页', () => {
  for (const { url, expected } of terminalAuthErrorUrlCases) {
    assert.equal(isTerminalAuthErrorUrl(url), expected, url);
  }
});
