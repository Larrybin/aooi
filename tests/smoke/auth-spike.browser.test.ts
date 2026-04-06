import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildResponseSummary,
  splitSetCookieHeader,
} from './auth-spike.browser';

test('splitSetCookieHeader 能拆分包含 Expires 与换行的多 cookie 头', () => {
  const header = [
    '__Secure-better-auth.session_token=token; Path=/; HttpOnly; Secure; SameSite=Lax',
    '__Secure-better-auth.dont_remember=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
  ].join('\n');

  assert.deepEqual(splitSetCookieHeader(header), [
    '__Secure-better-auth.session_token=token; Path=/; HttpOnly; Secure; SameSite=Lax',
    '__Secure-better-auth.dont_remember=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
  ]);
});

test('buildResponseSummary 以 cookie 粒度输出报告字段', () => {
  const summary = buildResponseSummary({
    url: 'https://example.com/api/auth/sign-out',
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    setCookieHeaders: [
      '__Secure-better-auth.session_token=token; Path=/; HttpOnly; Secure; SameSite=Lax',
      '__Secure-better-auth.dont_remember=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; Secure; SameSite=Lax',
    ],
  });

  assert.equal(summary.setCookieHeaderCount, 2);
  assert.equal(summary.setCookiePresent, true);
  assert.equal(summary.clearsCookie, true);
  assert.deepEqual(summary.cookies, [
    {
      name: '__Secure-better-auth.session_token',
      domain: 'example.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      clearsCookie: false,
    },
    {
      name: '__Secure-better-auth.dont_remember',
      domain: 'example.com',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      clearsCookie: true,
    },
  ]);
});
