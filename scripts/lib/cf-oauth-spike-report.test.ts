import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEmptyOAuthSpikeReport,
  createOAuthProviderResult,
} from '../../tests/smoke/oauth-spike.shared';
import {
  redactOAuthSpikeString,
  sanitizeOAuthSpikeReport,
} from './cf-oauth-spike-report';

test('redactOAuthSpikeString 脱敏 Better Auth cookie 与 session token', () => {
  const value =
    '__Secure-better-auth.session_token=secret-value; Path=/ {"session":{"token":"session-secret"}}';

  const redacted = redactOAuthSpikeString(value);

  assert.equal(redacted.includes('secret-value'), false);
  assert.equal(redacted.includes('session-secret'), false);
  assert.match(redacted, /__Secure-better-auth\.session_token=\[REDACTED\]/);
  assert.match(redacted, /"token":"\[REDACTED\]"/);
});

test('sanitizeOAuthSpikeReport 会脱敏报告中的敏感值', () => {
  const report = createEmptyOAuthSpikeReport({
    callbackPath: '/settings/profile',
    commitSha: 'test',
    runId: 'latest',
  });
  const provider = createOAuthProviderResult('google');

  provider.callbackSetCookieHeaders = [
    '__Secure-better-auth.session_token=secret-cookie; Path=/; HttpOnly; Secure',
  ];
  provider.callbackResponses = [
    {
      url: 'http://localhost:8787/api/auth/callback/google',
      status: 302,
      cacheControl: 'no-store',
      contentType: 'application/json',
      location: '/settings/profile',
      headers: {
        'set-cookie':
          '__Secure-better-auth.session_token=secret-cookie; Path=/; HttpOnly; Secure',
      },
      setCookieHeaderCount: 1,
      cookies: [],
      setCookiePresent: true,
      clearsCookie: false,
    },
  ];
  provider.sessionObservationAfterCallback = {
    url: 'http://localhost:8787/api/auth/get-session',
    status: 200,
    headers: {},
    bodySnippet: '{"session":{"token":"session-secret"},"user":{"email":"demo@example.com"}}',
    sessionPresent: true,
    userPresent: true,
  };
  report.providers.push(provider);

  const sanitized = sanitizeOAuthSpikeReport(report);

  assert.notStrictEqual(sanitized, report);
  assert.equal(
    sanitized.providers[0]?.callbackSetCookieHeaders[0]?.includes('secret-cookie'),
    false
  );
  assert.equal(
    sanitized.providers[0]?.callbackResponses[0]?.headers['set-cookie']?.includes(
      'secret-cookie'
    ),
    false
  );
  assert.equal(
    sanitized.providers[0]?.sessionObservationAfterCallback?.bodySnippet.includes(
      'session-secret'
    ),
    false
  );
});
