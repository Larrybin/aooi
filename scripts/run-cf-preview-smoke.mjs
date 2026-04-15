import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPreviewManager,
  ensureCiDevVars,
  normalizePreviewBaseUrl,
  parsePreviewReadyUrlFromLogs,
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
} from './lib/cloudflare-dev-runtime.mjs';
import {
  renderCloudflareLocalTopologyLogs,
  resolveCloudflareLocalDatabaseUrl,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const PREVIEW_READY_TIMEOUT_MS = Number.parseInt(
  process.env.CF_LOCAL_SMOKE_READY_TIMEOUT_MS || '180000',
  10
);
const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.CF_LOCAL_SMOKE_REQUEST_TIMEOUT_MS || '30000',
  10
);
const READY_URL_TIMEOUT_MS = Number.parseInt(
  process.env.CF_LOCAL_SMOKE_READY_URL_TIMEOUT_MS ||
    process.env.CF_LOCAL_SMOKE_READY_TIMEOUT_MS ||
    '180000',
  10
);
const POLL_INTERVAL_MS = 1000;
const PREVIEW_READY_CONSECUTIVE_SUCCESSES = Number.parseInt(
  process.env.CF_LOCAL_SMOKE_READY_CONSECUTIVE_SUCCESSES || '2',
  10
);

export {
  createPreviewManager,
  ensureCiDevVars,
  normalizePreviewBaseUrl,
  parsePreviewReadyUrlFromLogs,
  resolveAuthSecret,
  resolveConfiguredPreviewBaseUrl,
};

export function getCloudflarePreviewSmokeChecks() {
  return [
    {
      name: 'config-api',
      path: '/api/config/get-configs',
      requiredContentType: 'application/json',
      requiredTexts: ['"code":0', '"message":"ok"', '"app_name"'],
    },
    {
      name: 'sign-up-page',
      path: '/sign-up',
      requiredContentType: 'text/html',
      requiredTexts: ['auth-sign-up-form', '<title>Sign Up - '],
    },
    {
      name: 'sign-in-page',
      path: '/sign-in',
      requiredContentType: 'text/html',
      requiredTexts: ['auth-sign-in-form', '<title>Sign In - '],
    },
  ];
}

export function validateSmokeResponse(check, response, body) {
  if (
    response.status === 503 &&
    body.includes("Couldn't find a local dev session")
  ) {
    throw new Error(`local topology disconnected: ${body}`);
  }

  assert.equal(
    response.status,
    200,
    `[${check.name}] expected 200, got ${response.status}`
  );

  const contentType = response.headers.get('content-type') || '';
  assert.match(
    contentType,
    new RegExp(check.requiredContentType.replace('/', '\\/'), 'i'),
    `[${check.name}] unexpected content-type: ${contentType || 'n/a'}`
  );

  for (const requiredText of check.requiredTexts) {
    assert.match(
      body,
      new RegExp(escapeRegExp(requiredText), 'i'),
      `[${check.name}] missing expected text: ${requiredText}`
    );
  }
}

export async function runRepeatedRequestCheck({
  baseUrl,
  check,
  fetchImpl = fetch,
  logger = console,
}) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const url = `${baseUrl}${check.path}`;
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await response.text();

    validateSmokeResponse(check, response, body);
    logger.log(
      `✓ [${check.name}] attempt ${attempt}/2 -> ${response.status} ${url}`
    );
  }
}

export async function runCloudflarePreviewSmoke({
  baseUrl,
  fetchImpl = fetch,
  logger = console,
}) {
  for (const check of getCloudflarePreviewSmokeChecks()) {
    await runRepeatedRequestCheck({ baseUrl, check, fetchImpl, logger });
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForPreviewReady({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = PREVIEW_READY_TIMEOUT_MS,
  logger = console,
}) {
  const startedAt = Date.now();
  let lastError = null;
  let consecutiveSuccesses = 0;
  const [configCheck] = getCloudflarePreviewSmokeChecks();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(`${baseUrl}/api/config/get-configs`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = await response.text();

      validateSmokeResponse(configCheck, response, body);
      consecutiveSuccesses += 1;

      if (consecutiveSuccesses >= PREVIEW_READY_CONSECUTIVE_SUCCESSES) {
        logger.log(
          `✓ Cloudflare preview ready: ${baseUrl} (${consecutiveSuccesses} consecutive checks)`
        );
        return;
      }

      lastError = new Error(
        `preview not stable yet (${consecutiveSuccesses}/${PREVIEW_READY_CONSECUTIVE_SUCCESSES})`
      );
    } catch (error) {
      consecutiveSuccesses = 0;
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Cloudflare preview not ready within ${timeoutMs}ms: ${lastError?.message || 'unknown error'}`
  );
}

export async function resolvePreviewBaseUrl({
  preview,
  fallbackBaseUrl,
  timeoutMs = READY_URL_TIMEOUT_MS,
  logger = console,
  allowFallback = true,
}) {
  if (!preview?.readyUrlPromise) {
    return normalizePreviewBaseUrl(fallbackBaseUrl);
  }

  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('timed out waiting for Wrangler ready URL'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([preview.readyUrlPromise, timeoutPromise]);
  } catch (error) {
    if (!allowFallback) {
      throw error;
    }

    const normalizedFallback = normalizePreviewBaseUrl(fallbackBaseUrl);
    logger.warn?.(
      `Falling back to configured preview URL ${normalizedFallback}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return normalizedFallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function main() {
  const fallbackBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_LOCAL_SMOKE_URL
  );
  const reuseServer = process.env.CF_LOCAL_SMOKE_REUSE_SERVER === 'true';

  if (reuseServer) {
    console.log(`Reusing Cloudflare preview server: ${fallbackBaseUrl}`);
    await waitForPreviewReady({ baseUrl: fallbackBaseUrl });
    await runCloudflarePreviewSmoke({ baseUrl: fallbackBaseUrl });
    console.log('Cloudflare preview DB smoke passed');
    return;
  }

  const wranglerConfigPath =
    process.env.CF_LOCAL_SMOKE_WRANGLER_CONFIG_PATH?.trim() ||
    path.resolve(rootDir, 'wrangler.cloudflare.toml');
  const databaseUrl = await resolveCloudflareLocalDatabaseUrl({
    processEnv: process.env,
    wranglerConfigPath,
  });
  const topology = await startCloudflareLocalDevTopology({
    databaseUrl,
    routerTemplatePath: wranglerConfigPath,
    routerBaseUrl: fallbackBaseUrl,
    authSecret: resolveAuthSecret(),
  });
  const baseUrl = topology.getRouterBaseUrl();

  try {
    await waitForPreviewReady({ baseUrl });
    await runCloudflarePreviewSmoke({ baseUrl });
    console.log('Cloudflare preview DB smoke passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cloudflare preview DB smoke failed: ${message}`);

    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      console.error(recentLogs);
    }

    process.exitCode = 1;
  } finally {
    await topology.stop();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
