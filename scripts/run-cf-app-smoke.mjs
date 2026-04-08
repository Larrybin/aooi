import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPreviewManager,
  ensureCiDevVars,
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
  resolvePreviewBaseUrl,
  waitForPreviewReady,
} from './run-cf-preview-smoke.mjs';

const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.CF_APP_SMOKE_REQUEST_TIMEOUT_MS || '30000',
  10
);

export function getCloudflareAppSmokePublicChecks() {
  return [
    {
      name: 'landing-page',
      method: 'GET',
      path: '/',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['<html'],
    },
    {
      name: 'sign-in-page',
      method: 'GET',
      path: '/sign-in',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['auth-sign-in-form'],
    },
    {
      name: 'sign-up-page',
      method: 'GET',
      path: '/sign-up',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['auth-sign-up-form'],
    },
    {
      name: 'public-config-api',
      method: 'GET',
      path: '/api/config/get-configs',
      expectedStatus: 200,
      expectedContentType: /application\/json/i,
      expectedJsonShape: {
        code: 0,
      },
    },
    {
      name: 'docs-page',
      method: 'GET',
      path: '/docs',
      expectedStatus: 200,
      expectedContentType: /text\/html/i,
      expectedTexts: ['<html'],
    },
    {
      name: 'sitemap',
      method: 'GET',
      path: '/sitemap.xml',
      expectedStatus: 200,
      expectedContentType: /(application|text)\/xml/i,
      expectedTexts: ['<urlset'],
    },
    {
      name: 'robots',
      method: 'GET',
      path: '/robots.txt',
      expectedStatus: 200,
      expectedContentType: /text\/plain/i,
      expectedTexts: ['User-agent:'],
    },
  ];
}

export function getCloudflareAppSmokeProtectedChecks({
  baseUrlOrigin,
} = {}) {
  return [
    {
      name: 'settings-profile-protected',
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
      name: 'admin-settings-auth-protected',
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

export function getCloudflareAppSmokeChecks(options = {}) {
  return [
    ...getCloudflareAppSmokePublicChecks(),
    ...getCloudflareAppSmokeProtectedChecks(options),
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

    const url = new URL(location);
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

  if (check.expectedJson) {
    const parsed = JSON.parse(bodyText);
    assert.deepEqual(parsed, check.expectedJson);
    return;
  }

  if (check.expectedJsonShape) {
    const parsed = JSON.parse(bodyText);

    for (const [key, expectedValue] of Object.entries(
      check.expectedJsonShape
    )) {
      assert.deepEqual(
        parsed[key],
        expectedValue,
        `[${check.name}] unexpected json field ${key}`
      );
    }

    return;
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
  const baseUrlOrigin = new URL(baseUrl).origin;

  for (const check of getCloudflareAppSmokeChecks({ baseUrlOrigin })) {
    const response = await fetchImpl(`${baseUrl}${check.path}`, {
      method: check.method,
      headers: check.headers,
      body: check.body,
      redirect: check.redirect || 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const bodyText = await response.text();

    await validateCloudflareAppSmokeResponse(check, response, bodyText);
    logger.log(`✓ [${check.name}] ${check.method} ${baseUrl}${check.path}`);
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

export async function main() {
  const configuredBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_APP_SMOKE_URL,
    process.env.CF_PREVIEW_URL,
    process.env.CF_PREVIEW_APP_URL
  );
  const wranglerConfigPath =
    process.env.CF_PREVIEW_WRANGLER_CONFIG_PATH?.trim();
  const authSecret = resolveAuthSecret();
  const reuseServer = process.env.CF_PREVIEW_REUSE_SERVER === 'true';
  const devVars = await ensureCiDevVars({
    authSecret,
    extraVars: {
      DEPLOY_TARGET: 'cloudflare',
    },
  });

  const preview = reuseServer
    ? null
    : createPreviewManager({
        wranglerConfigPath,
      });
  const baseUrl = preview
    ? await resolvePreviewBaseUrl({
        preview,
        fallbackBaseUrl: configuredBaseUrl,
      })
    : normalizeOrigin(configuredBaseUrl, 'CF_APP_SMOKE_URL');

  try {
    await waitForPreviewReady({ baseUrl });
    await runCloudflareAppSmoke({ baseUrl });
  } finally {
    if (preview) {
      await preview.stop();
    }

    await devVars.cleanup();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
