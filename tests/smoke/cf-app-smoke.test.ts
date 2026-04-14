import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCloudflareAppSmokeChecks,
  getCloudflareAppSmokeProtectedChecks,
  validateCloudflareAppSmokeResponse,
} from '../../scripts/run-cf-app-smoke.mjs';

test('getCloudflareAppSmokeChecks 包含 full-app public 与 protected contract', () => {
  const checks = getCloudflareAppSmokeChecks({
    baseUrlOrigin: 'http://127.0.0.1:8787',
  }).map((check) => check.name);

  assert.deepEqual(checks, [
    'landing-page',
    'sign-in-page',
    'sign-up-page',
    'public-config-api',
    'docs-page',
    'sitemap',
    'robots',
    'settings-profile-protected',
    'admin-settings-auth-protected',
  ]);
});

test('validateCloudflareAppSmokeResponse 校验 public config api 结构', async () => {
  const check = getCloudflareAppSmokeChecks().find(
    (item) => item.name === 'public-config-api'
  );
  assert(check);

  const response = new Response(
    JSON.stringify({
      code: 0,
      message: 'ok',
      data: { ok: true },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  );

  await validateCloudflareAppSmokeResponse(
    check,
    response,
    '{"code":0,"message":"ok","data":{"ok":true}}'
  );
});

test('validateCloudflareAppSmokeResponse 校验 protected route 的同源重定向', async () => {
  const check = getCloudflareAppSmokeProtectedChecks({
    baseUrlOrigin: 'http://127.0.0.1:8787',
  }).find((item) => item.name === 'settings-profile-protected');
  assert(check);

  const response = new Response(null, {
    status: 307,
    headers: {
      location:
        'http://127.0.0.1:8787/sign-in?callbackUrl=%2Fsettings%2Fprofile',
    },
  });

  await validateCloudflareAppSmokeResponse(check, response, '');
});

test('validateCloudflareAppSmokeResponse 支持相对 Location 重定向头', async () => {
  const check = getCloudflareAppSmokeProtectedChecks({
    baseUrlOrigin: 'http://127.0.0.1:8787',
  }).find((item) => item.name === 'admin-settings-auth-protected');
  assert(check);

  const response = new Response(null, {
    status: 307,
    headers: {
      location: '/sign-in?callbackUrl=%2Fadmin%2Fsettings%2Fauth',
    },
  });

  Object.defineProperty(response, 'url', {
    configurable: true,
    value: 'http://127.0.0.1:8787/admin/settings/auth',
  });

  await validateCloudflareAppSmokeResponse(check, response, '');
});

test('validateCloudflareAppSmokeResponse 在 HTML 缺少关键内容时失败', async () => {
  const check = getCloudflareAppSmokeChecks().find(
    (item) => item.name === 'landing-page'
  );
  assert(check);

  const response = new Response('<html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  await assert.rejects(
    async () =>
      validateCloudflareAppSmokeResponse(check, response, '<body></body>'),
    /missing expected text/i
  );
});

test('main 在无 DATABASE_URL 时仍可完成只读 smoke', async () => {
  const originalEnv = {
    CF_PREVIEW_REUSE_SERVER: process.env.CF_PREVIEW_REUSE_SERVER,
    CF_APP_SMOKE_URL: process.env.CF_APP_SMOKE_URL,
    CF_PREVIEW_URL: process.env.CF_PREVIEW_URL,
    CF_PREVIEW_APP_URL: process.env.CF_PREVIEW_APP_URL,
    CF_APP_SMOKE_REQUEST_TIMEOUT_MS: process.env.CF_APP_SMOKE_REQUEST_TIMEOUT_MS,
    CF_PREVIEW_REQUEST_TIMEOUT_MS: process.env.CF_PREVIEW_REQUEST_TIMEOUT_MS,
    CF_PREVIEW_READY_TIMEOUT_MS: process.env.CF_PREVIEW_READY_TIMEOUT_MS,
    CF_PREVIEW_READY_CONSECUTIVE_SUCCESSES:
      process.env.CF_PREVIEW_READY_CONSECUTIVE_SUCCESSES,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SPIKE_DATABASE_URL: process.env.AUTH_SPIKE_DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
  };
  const originalFetch = globalThis.fetch;

  process.env.CF_PREVIEW_REUSE_SERVER = 'true';
  process.env.CF_APP_SMOKE_URL = '';
  process.env.CF_PREVIEW_URL = '';
  process.env.CF_PREVIEW_APP_URL = 'http://127.0.0.1:8787';
  process.env.CF_APP_SMOKE_REQUEST_TIMEOUT_MS = '1';
  process.env.CF_PREVIEW_REQUEST_TIMEOUT_MS = '1';
  process.env.CF_PREVIEW_READY_TIMEOUT_MS = '10';
  process.env.CF_PREVIEW_READY_CONSECUTIVE_SUCCESSES = '1';
  process.env.DATABASE_URL = '';
  process.env.AUTH_SPIKE_DATABASE_URL = '';
  process.env.BETTER_AUTH_SECRET = 'test-auth-secret';
  process.env.AUTH_SECRET = 'test-auth-secret';

  globalThis.fetch = async (input) => {
    const requestUrl = new URL(String(input));

    switch (requestUrl.pathname) {
      case '/':
        return new Response('<html><body>ok</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      case '/sign-up':
        return new Response(
          '<html><head><title>Sign Up - Roller Rabbit</title></head><body><form id="auth-sign-up-form"></form></body></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        );
      case '/sign-in':
        return new Response(
          '<html><head><title>Sign In - Roller Rabbit</title></head><body><form id="auth-sign-in-form"></form></body></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        );
      case '/api/config/get-configs':
        return new Response(
          JSON.stringify({
            code: 0,
            message: 'ok',
            data: { app_name: 'Roller Rabbit' },
            app_name: 'Roller Rabbit',
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json; charset=utf-8' },
          }
        );
      case '/docs':
        return new Response('<html><body>docs</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      case '/sitemap.xml':
        return new Response('<urlset></urlset>', {
          status: 200,
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        });
      case '/robots.txt':
        return new Response('User-agent: *\nAllow: /', {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      case '/settings/profile':
      case '/admin/settings/auth':
        return new Response(null, {
          status: 307,
          headers: {
            location: `http://127.0.0.1:8787/sign-in?callbackUrl=${encodeURIComponent(
              requestUrl.pathname
            )}`,
          },
        });
      default:
        return new Response('not found', { status: 404 });
    }
  };

  try {
    const { main: isolatedMain } = await import(
      `../../scripts/run-cf-app-smoke.mjs?test=${Date.now()}`
    );
    await isolatedMain();
  } finally {
    globalThis.fetch = originalFetch;

    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
});
