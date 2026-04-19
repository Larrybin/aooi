import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveHarnessExitCode } from '../../scripts/lib/harness/reporter.mjs';
import {
  renderMarkdown,
  runPreflightChecks,
} from '../../scripts/run-auth-spike.mjs';
import {
  buildSurfaceRunEmails,
  createEmptyReport,
} from '../../src/testing/auth-spike.shared';

test('runPreflightChecks 分类相同 surface URL 与页面不可达', async () => {
  const fetchCalls: string[] = [];
  const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    fetchCalls.push(url);

    if (url.endsWith('/sign-up')) {
      return new Response('missing', { status: 404 });
    }

    return new Response('ok', { status: 200 });
  }) as typeof fetch;

  const result = await runPreflightChecks(
    {
      vercelUrl: 'https://app.example.com',
      cloudflareUrl: 'https://app.example.com',
      callbackPathInput: '/settings/profile',
    },
    fakeFetch
  );

  assert.equal(result.normalizedCallbackPath, '/settings/profile');
  assert.equal(
    result.checks.some(
      (check) =>
        check.surface === 'global' &&
        check.name === 'distinct-surfaces' &&
        check.status === 'failed'
    ),
    true
  );
  assert.equal(
    result.checks.some(
      (check) =>
        check.name === 'sign-up-page' &&
        check.surface === 'vercel' &&
        check.status === 'failed'
    ),
    true
  );
  assert.equal(fetchCalls.length >= 6, true);
});

test('runPreflightChecks 对瞬时 fetch failed 做重试而不是直接抛错', async () => {
  const attempts = new Map<string, number>();
  const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    const attempt = (attempts.get(url) || 0) + 1;
    attempts.set(url, attempt);

    if (url === 'https://cf.example.com/sign-in' && attempt === 1) {
      throw new TypeError('fetch failed');
    }

    return new Response('ok', { status: 200 });
  }) as typeof fetch;

  const result = await runPreflightChecks(
    {
      vercelUrl: 'https://vercel.example.com',
      cloudflareUrl: 'https://cf.example.com',
      callbackPathInput: '/settings/profile',
    },
    fakeFetch
  );

  assert.equal(
    result.checks.some(
      (check) =>
        check.surface === 'cloudflare' &&
        check.name === 'sign-in-page' &&
        check.status === 'passed' &&
        /after retry/i.test(check.detail)
    ),
    true
  );
});

test('resolveHarnessExitCode 只在 harness PASS 且子进程成功时返回 0', () => {
  assert.equal(resolveHarnessExitCode({ harnessStatus: 'PASS' }, 0), 0);
  assert.equal(resolveHarnessExitCode({ harnessStatus: 'FAIL' }, 0), 1);
  assert.equal(resolveHarnessExitCode({ harnessStatus: 'PASS' }, 7), 7);
});

test('renderMarkdown 输出 harness 语义和 preflight 信息', () => {
  const report = createEmptyReport({
    callbackPath: '/settings/profile',
    commitSha: 'test-sha',
    emails: buildSurfaceRunEmails('auth-spike@example.com', 'render-1'),
    runId: 'render-1',
  });
  report.preflight.push({
    name: 'distinct-surfaces',
    status: 'passed',
    detail: 'surface URLs are distinct',
    surface: 'global',
  });

  const markdown = renderMarkdown(report);

  assert.match(markdown, /# Auth Spike Feasibility Report/);
  assert.match(markdown, /Harness status: FAIL/);
  assert.match(markdown, /Preflight/);
  assert.match(markdown, /auth-spike\+vercel-render-1@example.com/);
});
