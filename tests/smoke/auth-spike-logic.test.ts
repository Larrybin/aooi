import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSurfaceRunEmails,
  createEmptyReport,
  createSurfaceResult,
  deriveConclusion,
  deriveParityResult,
  normalizeCallbackPath,
  type Report,
  type ResponseSummary,
  type SessionObservation,
} from '../../src/testing/auth-spike.shared';

function responseSummary(
  overrides: Partial<ResponseSummary> = {}
): ResponseSummary {
  return {
    url: 'https://example.com/api/auth/sign-in',
    status: 200,
    cacheControl: 'no-store',
    contentType: 'application/json',
    location: null,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    setCookieHeaderCount: 1,
    cookies: [
      {
        name: 'session',
        domain: 'example.com',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        clearsCookie: false,
      },
    ],
    setCookiePresent: true,
    clearsCookie: false,
    ...overrides,
  };
}

function sessionObservation(
  overrides: Partial<SessionObservation> = {}
): SessionObservation {
  return {
    url: 'https://example.com/api/auth/get-session',
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json',
    },
    bodySnippet: '{"session":{"id":"sess"},"user":{"id":"user"}}',
    sessionPresent: true,
    userPresent: true,
    ...overrides,
  };
}

function passingReport(): Report {
  const report = createEmptyReport({
    callbackPath: '/settings/profile',
    commitSha: 'test-sha',
    emails: buildSurfaceRunEmails('auth-spike@example.com', 'run-1'),
    runId: 'run-1',
  });

  const vercel = createSurfaceResult(
    'vercel',
    'https://vercel.example.com',
    report.emails.vercel
  );
  const cloudflare = createSurfaceResult(
    'cloudflare',
    'https://cloudflare.example.com',
    report.emails.cloudflare
  );

  for (const surface of [vercel, cloudflare]) {
    surface.signUpResponses = [responseSummary()];
    surface.signInResponses = [responseSummary()];
    surface.signOutResponses = [responseSummary({ clearsCookie: true })];
    surface.sessionAfterSignUp = sessionObservation();
    surface.sessionAfterSignIn = sessionObservation();
    surface.sessionAfterSignOut = sessionObservation({
      bodySnippet: 'null',
      sessionPresent: false,
      userPresent: false,
    });
    surface.finalUrlAfterSignUp = '/settings/profile';
    surface.finalUrlAfterSignIn = '/settings/profile';
    surface.finalUrlAfterInvalidCookie =
      '/sign-in?callbackUrl=%2Fsettings%2Fprofile';
    surface.finalUrlAfterSignOut = '/';
  }

  report.surfaces = [vercel, cloudflare];
  report.parity = deriveParityResult(report);
  const conclusion = deriveConclusion(report);
  report.rawConclusion = conclusion.rawConclusion;
  report.harnessStatus = conclusion.harnessStatus;
  report.failureSummary = conclusion.failureSummary;

  return report;
}

test('normalizeCallbackPath 拒绝绝对 URL', () => {
  assert.throws(
    () => normalizeCallbackPath('https://evil.example.com/callback'),
    /AUTH_SPIKE_CALLBACK_PATH/
  );
  assert.equal(normalizeCallbackPath('settings/profile'), '/settings/profile');
});

test('buildSurfaceRunEmails 为每个 surface 生成不同邮箱', () => {
  const emails = buildSurfaceRunEmails('auth-spike@example.com', 'Run_42');
  assert.equal(emails.vercel, 'auth-spike+vercel-run-42@example.com');
  assert.equal(emails.cloudflare, 'auth-spike+cloudflare-run-42@example.com');
  assert.notEqual(emails.vercel, emails.cloudflare);
});

test('deriveConclusion 对全绿报告返回 PASS', () => {
  const report = passingReport();

  assert.equal(report.parity?.status, 'passed');
  assert.equal(report.rawConclusion, 'PASS');
  assert.equal(report.harnessStatus, 'PASS');
  assert.deepEqual(report.failureSummary, []);
});

test('deriveConclusion 对单面 cloudflare preview auth spike 全绿仍返回 PASS', () => {
  const report = createEmptyReport({
    callbackPath: '/settings/profile',
    commitSha: 'test-sha',
    emails: buildSurfaceRunEmails('auth-spike@example.com', 'run-2'),
    runId: 'run-2',
  });
  const cloudflare = createSurfaceResult(
    'cloudflare',
    'http://127.0.0.1:8787',
    report.emails.cloudflare
  );

  cloudflare.signUpResponses = [responseSummary()];
  cloudflare.signInResponses = [responseSummary()];
  cloudflare.signOutResponses = [responseSummary({ clearsCookie: true })];
  cloudflare.sessionAfterSignUp = sessionObservation();
  cloudflare.sessionAfterSignIn = sessionObservation();
  cloudflare.sessionAfterSignOut = sessionObservation({
    bodySnippet: 'null',
    sessionPresent: false,
    userPresent: false,
  });
  cloudflare.finalUrlAfterSignUp = '/settings/profile';
  cloudflare.finalUrlAfterSignIn = '/settings/profile';
  cloudflare.finalUrlAfterInvalidCookie =
    '/sign-in?callbackUrl=%2Fsettings%2Fprofile';
  cloudflare.finalUrlAfterSignOut = '/';
  report.surfaces = [cloudflare];

  const conclusion = deriveConclusion(report);

  assert.equal(conclusion.rawConclusion, 'PASS');
  assert.equal(conclusion.harnessStatus, 'PASS');
});

test('deriveConclusion 对纯 parity 失败返回 需要 adapter', () => {
  const report = passingReport();
  const cloudflare = report.surfaces.find(
    (surface) => surface.surface === 'cloudflare'
  );

  assert(cloudflare);

  cloudflare.signInResponses = [
    responseSummary({
      status: 302,
      location: '/sign-in?error=parity',
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json',
        location: '/sign-in?error=parity',
      },
      setCookiePresent: false,
      setCookieHeaderCount: 0,
      cookies: [],
      clearsCookie: false,
    }),
  ];
  cloudflare.sessionAfterSignIn = sessionObservation({
    bodySnippet: '{"session":null,"user":null}',
    sessionPresent: false,
    userPresent: false,
  });
  report.parity = deriveParityResult(report);

  const conclusion = deriveConclusion(report);

  assert.equal(conclusion.rawConclusion, '需要 adapter');
  assert.equal(conclusion.harnessStatus, 'FAIL');
  assert.match(conclusion.failureSummary.join('\n'), /parity:/);
});

test('deriveParityResult 忽略固定 whitelist 头差异', () => {
  const report = passingReport();
  const vercel = report.surfaces.find((surface) => surface.surface === 'vercel');
  const cloudflare = report.surfaces.find(
    (surface) => surface.surface === 'cloudflare'
  );

  assert(vercel);
  assert(cloudflare);

  vercel.signInResponses = [
    responseSummary({
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json; charset=utf-8',
        date: 'Mon, 07 Apr 2026 10:00:00 GMT',
        'x-request-id': 'vercel-request',
        'x-vercel-id': 'iad1::vercel',
      },
    }),
  ];
  cloudflare.signInResponses = [
    responseSummary({
      headers: {
        'cache-control': 'no-store',
        'content-type': 'application/json',
        date: 'Mon, 07 Apr 2026 10:00:01 GMT',
        'x-request-id': 'cloudflare-request',
        'cf-ray': '12345',
      },
    }),
  ];

  const parity = deriveParityResult(report);

  assert.equal(parity.status, 'passed');
});

test('deriveConclusion 对 cloudflare auth 不可用返回 需要替代路线', () => {
  const report = passingReport();
  const cloudflare = report.surfaces.find(
    (surface) => surface.surface === 'cloudflare'
  );

  assert(cloudflare);

  cloudflare.cases.push({
    name: 'sign_up_fresh_account',
    status: 'failed',
    detail: '500 internal error',
    screenshotPath: null,
  });
  cloudflare.failureKinds.push('auth_flow_unavailable');

  const conclusion = deriveConclusion(report);

  assert.equal(conclusion.rawConclusion, '需要替代路线');
  assert.equal(conclusion.harnessStatus, 'FAIL');
});

test('deriveConclusion 对 preflight 失败返回 BLOCKED', () => {
  const report = passingReport();

  report.preflight.push({
    name: 'sign-up-page',
    status: 'failed',
    detail: '404',
    surface: 'cloudflare',
  });

  const conclusion = deriveConclusion(report);

  assert.equal(conclusion.rawConclusion, 'BLOCKED');
  assert.equal(conclusion.harnessStatus, 'FAIL');
  assert.match(
    conclusion.failureSummary.join('\n'),
    /preflight:cloudflare:sign-up-page:404/
  );
});
