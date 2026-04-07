import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const PREVIEW_READY_TIMEOUT_MS = Number.parseInt(
  process.env.CF_PREVIEW_READY_TIMEOUT_MS || '180000',
  10
);
const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.CF_PREVIEW_REQUEST_TIMEOUT_MS || '30000',
  10
);
const READY_URL_TIMEOUT_MS = Number.parseInt(
  process.env.CF_PREVIEW_READY_URL_TIMEOUT_MS ||
    process.env.CF_PREVIEW_READY_TIMEOUT_MS ||
    '180000',
  10
);
const POLL_INTERVAL_MS = 1000;
const PREVIEW_READY_CONSECUTIVE_SUCCESSES = Number.parseInt(
  process.env.CF_PREVIEW_READY_CONSECUTIVE_SUCCESSES || '2',
  10
);

export function normalizePreviewBaseUrl(input) {
  const raw = input?.trim() || 'http://localhost:8787';
  const url = new URL(raw);
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function resolveConfiguredPreviewBaseUrl(...candidates) {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return normalizePreviewBaseUrl(trimmed);
    }
  }

  return normalizePreviewBaseUrl(undefined);
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

export function parsePreviewReadyUrlFromLogs(value) {
  const match = stripAnsi(value).match(/\bReady on (https?:\/\/[^\s]+)/i);
  if (!match?.[1]) {
    return null;
  }

  return normalizePreviewBaseUrl(match[1]);
}

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

export function createPreviewManager({
  cwd = rootDir,
  env = process.env,
  logger = console,
  wranglerConfigPath,
}) {
  const args = ['cf:preview'];
  if (wranglerConfigPath) {
    args.push('--', '--config', wranglerConfigPath);
  }

  const child = spawn('pnpm', args, {
    cwd,
    env,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const recentLogs = [];
  let logBuffer = '';
  let stopping = false;
  let readyUrl = null;
  let resolveReadyUrl;
  let rejectReadyUrl;
  const readyUrlPromise = new Promise((resolve, reject) => {
    resolveReadyUrl = resolve;
    rejectReadyUrl = reject;
  });

  function appendLog(chunk) {
    const text = chunk.toString();
    if (!stopping) {
      process.stdout.write(text);
    }
    recentLogs.push(text);
    if (recentLogs.length > 120) {
      recentLogs.shift();
    }

    if (readyUrl) {
      return;
    }

    logBuffer = `${logBuffer}${text}`.slice(-16_384);
    const nextReadyUrl = parsePreviewReadyUrlFromLogs(logBuffer);
    if (!nextReadyUrl) {
      return;
    }

    readyUrl = nextReadyUrl;
    resolveReadyUrl(nextReadyUrl);
    logger.log(`Detected Cloudflare preview ready URL: ${nextReadyUrl}`);
  }

  child.stdout?.on('data', appendLog);
  child.stderr?.on('data', appendLog);

  child.on('exit', (code, signal) => {
    if (!readyUrl) {
      rejectReadyUrl(
        new Error(
          `Cloudflare preview exited before emitting a ready URL (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
        )
      );
    }

    if (stopping) {
      return;
    }

    if (code !== null && code !== 0) {
      logger.error(`Cloudflare preview exited early with code ${code}`);
    } else if (signal) {
      logger.error(`Cloudflare preview exited via signal ${signal}`);
    }
  });

  return {
    child,
    recentLogs,
    readyUrlPromise,
    async stop() {
      if (child.exitCode !== null) {
        return;
      }

      stopping = true;

      const exitedGracefully = await requestGracefulPreviewShutdown(child);
      if (exitedGracefully) {
        return;
      }

      killPreviewProcess(child, 'SIGINT');

      const exitedAfterSigint = await waitForChildExit(child, 10_000);

      if (!exitedAfterSigint && child.exitCode === null) {
        killPreviewProcess(child, 'SIGKILL');
        await waitForChildExit(child, 5_000);
      }
    },
  };
}

async function waitForChildExit(child, timeoutMs) {
  if (child.exitCode !== null) {
    return true;
  }

  const exitPromise = once(child, 'exit')
    .then(() => true)
    .catch(() => false);

  return Promise.race([exitPromise, sleep(timeoutMs).then(() => false)]);
}

async function requestGracefulPreviewShutdown(child) {
  if (!child.stdin || child.stdin.destroyed) {
    return false;
  }

  try {
    child.stdin.write('x');
  } catch {
    return false;
  }

  return waitForChildExit(child, 5_000);
}

function killPreviewProcess(child, signal) {
  if (!child.pid) {
    return;
  }

  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // fall through
    }
  }

  child.kill(signal);
}

export function resolveAuthSecret() {
  return (
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    'ci-auth-secret-not-for-production'
  );
}

export async function ensureCiDevVars({
  authSecret,
  devVarsPath = path.resolve(rootDir, '.dev.vars'),
}) {
  let originalContent = null;

  try {
    originalContent = await readFile(devVarsPath, 'utf8');
  } catch {
    originalContent = null;
  }

  const existingContent = originalContent || '';
  const existingAuthSecret = readDevVar(existingContent, 'AUTH_SECRET');
  const existingBetterAuthSecret = readDevVar(
    existingContent,
    'BETTER_AUTH_SECRET'
  );
  const nextAuthSecret =
    existingAuthSecret || existingBetterAuthSecret || authSecret;

  let nextContent = existingContent;
  nextContent = upsertDevVar(nextContent, 'AUTH_SECRET', nextAuthSecret);
  nextContent = upsertDevVar(
    nextContent,
    'BETTER_AUTH_SECRET',
    existingBetterAuthSecret || existingAuthSecret || authSecret
  );

  const created = originalContent === null;
  const updated = nextContent !== existingContent;

  if (created || updated) {
    await writeFile(devVarsPath, nextContent, 'utf8');
  }

  return {
    created,
    updated,
    devVarsPath,
    async cleanup() {
      if (created) {
        await rm(devVarsPath, { force: true });
        return;
      }

      if (updated && originalContent !== null) {
        await writeFile(devVarsPath, originalContent, 'utf8');
      }
    },
  };
}

async function main() {
  const fallbackBaseUrl = resolveConfiguredPreviewBaseUrl(
    process.env.CF_PREVIEW_URL,
    process.env.CF_PREVIEW_APP_URL
  );
  const reuseServer = process.env.CF_PREVIEW_REUSE_SERVER === 'true';

  if (reuseServer) {
    console.log(`Reusing Cloudflare preview server: ${fallbackBaseUrl}`);
    await waitForPreviewReady({ baseUrl: fallbackBaseUrl });
    await runCloudflarePreviewSmoke({ baseUrl: fallbackBaseUrl });
    console.log('Cloudflare preview DB smoke passed');
    return;
  }

  const authSecret = resolveAuthSecret();
  const devVars = await ensureCiDevVars({ authSecret });
  const preview = createPreviewManager({});
  const baseUrl = await resolvePreviewBaseUrl({
    preview,
    fallbackBaseUrl,
  });

  try {
    await waitForPreviewReady({ baseUrl });
    await runCloudflarePreviewSmoke({ baseUrl });
    console.log('Cloudflare preview DB smoke passed');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Cloudflare preview DB smoke failed: ${message}`);

    if (preview.recentLogs.length > 0) {
      console.error('--- recent preview logs ---');
      console.error(preview.recentLogs.join(''));
      console.error('--- end preview logs ---');
    }

    process.exitCode = 1;
  } finally {
    await preview.stop();
    await devVars.cleanup();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}

function readDevVar(content, name) {
  const match = content.match(new RegExp(`^${name}=([^\\n]*)$`, 'm'));
  const value = match?.[1]?.trim();
  return value || null;
}

function upsertDevVar(content, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  if (!content) {
    return `${line}\n`;
  }

  return content.endsWith('\n') ? `${content}${line}\n` : `${content}\n${line}\n`;
}
