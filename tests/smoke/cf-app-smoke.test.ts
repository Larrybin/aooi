import assert from 'node:assert/strict';
import test from 'node:test';

import { getCurrentSiteAppUrl } from '../../scripts/lib/current-site.mjs';
import {
  getCloudflareAppSmokeChecks,
  resolveCloudflareAppSmokeUrl,
  runCloudflareAppSmoke,
  validateCloudflareAppSmokeResponse,
} from '../../scripts/run-cf-app-smoke.mjs';

test('getCloudflareAppSmokeChecks 覆盖 default/docs/image/chat/member/admin 路由', () => {
  const checks = getCloudflareAppSmokeChecks({
    baseUrlOrigin: 'https://mamamiya.pdfreprinting.net',
  }).map((check) => check.name);

  assert.deepEqual(checks, [
    'default-route',
    'docs-route',
    'image-route',
    'chat-public-route',
    'member-protected-route',
    'admin-protected-route',
  ]);
});

test('validateCloudflareAppSmokeResponse 校验图片响应 content-type', async () => {
  const check = getCloudflareAppSmokeChecks().find(
    (item) => item.name === 'image-route'
  );
  assert(check);

  const response = new Response('binary', {
    status: 200,
    headers: { 'content-type': 'image/png' },
  });

  await validateCloudflareAppSmokeResponse(check, response, 'binary');
});

test('validateCloudflareAppSmokeResponse 校验 protected route 的同源重定向', async () => {
  const check = getCloudflareAppSmokeChecks({
    baseUrlOrigin: 'https://mamamiya.pdfreprinting.net',
  }).find((item) => item.name === 'member-protected-route');
  assert(check);

  const response = new Response(null, {
    status: 307,
    headers: {
      location:
        'https://mamamiya.pdfreprinting.net/sign-in?callbackUrl=%2Fsettings%2Fprofile',
    },
  });

  await validateCloudflareAppSmokeResponse(check, response, '');
});

test('validateCloudflareAppSmokeResponse 支持相对 Location 重定向头', async () => {
  const check = getCloudflareAppSmokeChecks({
    baseUrlOrigin: 'https://mamamiya.pdfreprinting.net',
  }).find((item) => item.name === 'admin-protected-route');
  assert(check);

  const response = new Response(null, {
    status: 307,
    headers: {
      location: '/sign-in?callbackUrl=%2Fadmin%2Fsettings%2Fauth',
    },
  });

  Object.defineProperty(response, 'url', {
    configurable: true,
    value: 'https://mamamiya.pdfreprinting.net/admin/settings/auth',
  });

  await validateCloudflareAppSmokeResponse(check, response, '');
});

test('resolveCloudflareAppSmokeUrl 优先使用显式 smoke url，其次 NEXT_PUBLIC_APP_URL', () => {
  const originalSmokeUrl = process.env.CF_APP_SMOKE_URL;
  const originalSite = process.env.SITE;

  process.env.CF_APP_SMOKE_URL = 'https://smoke.example.com';
  assert.equal(resolveCloudflareAppSmokeUrl(), 'https://smoke.example.com');

  delete process.env.CF_APP_SMOKE_URL;
  process.env.SITE = 'mamamiya';
  assert.equal(resolveCloudflareAppSmokeUrl(), getCurrentSiteAppUrl());

  if (originalSmokeUrl === undefined) {
    delete process.env.CF_APP_SMOKE_URL;
  } else {
    process.env.CF_APP_SMOKE_URL = originalSmokeUrl;
  }

  if (originalSite === undefined) {
    delete process.env.SITE;
  } else {
    process.env.SITE = originalSite;
  }
});

test('runCloudflareAppSmoke 对生产只读 smoke 路由逐项校验', async () => {
  const responses = new Map([
    [
      '/pricing',
      new Response('<html><body>pricing</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ],
    [
      '/docs',
      new Response('<html><body>docs</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ],
    [
      '/_next/image',
      new Response('png', {
        status: 200,
        headers: { 'content-type': 'image/png' },
      }),
    ],
    [
      '/chat',
      new Response('<html><body><button>Sign In</button></body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      }),
    ],
    [
      '/settings/profile',
      new Response(null, {
        status: 307,
        headers: {
          location:
            'https://mamamiya.pdfreprinting.net/sign-in?callbackUrl=%2Fsettings%2Fprofile',
        },
      }),
    ],
    [
      '/admin/settings/auth',
      new Response(null, {
        status: 307,
        headers: {
          location:
            'https://mamamiya.pdfreprinting.net/sign-in?callbackUrl=%2Fadmin%2Fsettings%2Fauth',
        },
      }),
    ],
  ]);

  const visited = [];

  await runCloudflareAppSmoke({
    baseUrl: 'https://mamamiya.pdfreprinting.net',
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      visited.push(url.pathname);
      const response = responses.get(url.pathname);
      assert(response, `unexpected smoke request: ${url.pathname}`);
      return response;
    },
    logger: { log() {} },
  });

  assert.deepEqual(visited, [
    '/pricing',
    '/docs',
    '/_next/image',
    '/chat',
    '/settings/profile',
    '/admin/settings/auth',
  ]);
});
