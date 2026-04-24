import assert from 'node:assert/strict';

import { getCurrentSiteAppUrl } from './lib/current-site.mjs';

const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.CF_APP_SMOKE_REQUEST_TIMEOUT_MS || '30000',
  10
);

export function getCloudflareAppSmokeChecks({ baseUrlOrigin } = {}) {
  return [
    {
      name: 'default-route',
      method: 'GET',
      path: '/pricing',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['<html'],
    },
    {
      name: 'docs-route',
      method: 'GET',
      path: '/docs',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['<html'],
    },
    {
      name: 'image-route',
      method: 'GET',
      path: '/_next/image?url=%2Flogo.png&w=64&q=75',
      expectedStatus: 200,
      expectedContentType: /image\//i,
    },
    {
      name: 'chat-public-route',
      method: 'GET',
      path: '/chat',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['Sign In'],
    },
    {
      name: 'member-protected-route',
      method: 'GET',
      path: '/settings/profile',
      expectedStatus: 307,
      expectedLocationOrigin: baseUrlOrigin,
      expectedLocationPath: '/sign-in',
      expectedLocationSearchParams: {
        callbackUrl: '/settings/profile',
      },
      redirect: 'manual',
    },
    {
      name: 'admin-protected-route',
      method: 'GET',
      path: '/admin/settings/auth',
      expectedStatus: 307,
      expectedLocationOrigin: baseUrlOrigin,
      expectedLocationPath: '/sign-in',
      expectedLocationSearchParams: {
        callbackUrl: '/admin/settings/auth',
      },
      redirect: 'manual',
    },
  ];
}

export async function validateCloudflareAppSmokeResponse(
  check,
  response,
  bodyText
) {
  assert.equal(
    response.status,
    check.expectedStatus,
    `[${check.name}] expected ${check.expectedStatus}, got ${response.status}`
  );

  if (check.expectedContentType) {
    const contentType = response.headers.get('content-type') || '';
    assert.match(
      contentType,
      check.expectedContentType,
      `[${check.name}] unexpected content-type: ${contentType || 'n/a'}`
    );
  }

  if (
    check.expectedLocationOrigin ||
    check.expectedLocationPath ||
    check.expectedLocationSearchParams
  ) {
    const location = response.headers.get('location') || '';
    assert.ok(location, `[${check.name}] missing Location header`);

    const responseUrl = response.url || `http://localhost${check.path || '/'}`;
    const url = new URL(location, responseUrl);

    if (check.expectedLocationOrigin) {
      assert.equal(
        url.origin,
        check.expectedLocationOrigin,
        `[${check.name}] unexpected Location origin`
      );
    }

    if (check.expectedLocationPath) {
      assert.equal(
        url.pathname,
        check.expectedLocationPath,
        `[${check.name}] unexpected Location path`
      );
    }

    if (check.expectedLocationSearchParams) {
      for (const [key, expectedValue] of Object.entries(
        check.expectedLocationSearchParams
      )) {
        assert.equal(
          url.searchParams.get(key),
          expectedValue,
          `[${check.name}] unexpected Location search param ${key}`
        );
      }
    }
  }

  for (const expectedText of check.expectedTexts || []) {
    assert.match(
      bodyText,
      new RegExp(escapeRegExp(expectedText), 'i'),
      `[${check.name}] missing expected text: ${expectedText}`
    );
  }
}

export async function runCloudflareAppSmoke({
  baseUrl,
  fetchImpl = fetch,
  logger = console,
}) {
  const normalizedBaseUrl = normalizeOrigin(baseUrl, 'CF_APP_SMOKE_URL');
  const baseUrlOrigin = new URL(normalizedBaseUrl).origin;

  for (const check of getCloudflareAppSmokeChecks({ baseUrlOrigin })) {
    const response = await fetchImpl(`${normalizedBaseUrl}${check.path}`, {
      method: check.method,
      headers: check.headers,
      body: check.body,
      redirect: check.redirect || 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const bodyText = await response.text();

    await validateCloudflareAppSmokeResponse(check, response, bodyText);
    logger.log(
      `✓ [${check.name}] ${check.method} ${normalizedBaseUrl}${check.path}`
    );
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOrigin(value, label) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`${label} is required`);
  }

  const url = new URL(trimmed);
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function resolveCloudflareAppSmokeUrl() {
  return process.env.CF_APP_SMOKE_URL?.trim() || getCurrentSiteAppUrl();
}

export async function main() {
  const baseUrl = resolveCloudflareAppSmokeUrl();
  await runCloudflareAppSmoke({ baseUrl });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
