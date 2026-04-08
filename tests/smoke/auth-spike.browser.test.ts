import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertSignedInSession,
  assertSignedOutSession,
  buildAuthFailureDetail,
  buildSessionObservation,
  buildResponseSummary,
  splitSetCookieHeader,
} from './auth-spike.browser';
import { hasSecureCookieFlags } from './auth-spike.shared';

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

test('hasSecureCookieFlags 允许本地 http 验收使用非 secure cookie', () => {
  const summary = buildResponseSummary({
    url: 'http://127.0.0.1:8787/api/auth/sign-up/email',
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    setCookieHeaders: [
      'better-auth.session_token=token; Path=/; HttpOnly; SameSite=Lax',
    ],
  });

  assert.equal(hasSecureCookieFlags([summary]), true);
});

test('hasSecureCookieFlags 仍要求非本地 origin 带 secure cookie', () => {
  const summary = buildResponseSummary({
    url: 'https://example.com/api/auth/sign-up/email',
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    setCookieHeaders: [
      'better-auth.session_token=token; Path=/; HttpOnly; SameSite=Lax',
    ],
  });

  assert.equal(hasSecureCookieFlags([summary]), false);
});

test('buildAuthFailureDetail 在失败时保留 auth 响应与当前 URL', () => {
  const summary = buildResponseSummary({
    url: 'http://127.0.0.1:3100/api/auth/sign-up/email',
    status: 500,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    setCookieHeaders: [],
  });

  const detail = buildAuthFailureDetail({
    flow: 'sign-up',
    error: new Error('request failed'),
    currentUrl: '/sign-up?callbackUrl=%2Fsettings%2Fprofile',
    responses: [summary],
  });

  assert.match(detail, /request failed/);
  assert.match(detail, /sign-up auth responses: 500 \/api\/auth\/sign-up\/email/);
  assert.match(
    detail,
    /sign-up final URL: \/sign-up\?callbackUrl=%2Fsettings%2Fprofile/
  );
});

test('buildSessionObservation 能识别已登录 session body', () => {
  const observation = buildSessionObservation({
    url: 'https://example.com/api/auth/get-session',
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: JSON.stringify({
      session: { id: 'sess-1' },
      user: { id: 'user-1' },
    }),
  });

  assert.equal(observation.sessionPresent, true);
  assert.equal(observation.userPresent, true);
  assert.doesNotThrow(() => assertSignedInSession(observation));
});

test('buildSessionObservation 能识别已登出 null body', () => {
  const observation = buildSessionObservation({
    url: 'https://example.com/api/auth/get-session',
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
    bodyText: 'null',
  });

  assert.equal(observation.sessionPresent, false);
  assert.equal(observation.userPresent, false);
  assert.doesNotThrow(() => assertSignedOutSession(observation));
});
