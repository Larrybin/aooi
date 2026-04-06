import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
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
const POLL_INTERVAL_MS = 1000;

export function normalizePreviewBaseUrl(input) {
  const raw = input?.trim() || 'http://localhost:8787';
  const url = new URL(raw);
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
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

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(`${baseUrl}/api/config/get-configs`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 200) {
        logger.log(`✓ Cloudflare preview ready: ${baseUrl}`);
        return;
      }

      lastError = new Error(`readiness returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Cloudflare preview not ready within ${timeoutMs}ms: ${lastError?.message || 'unknown error'}`
  );
}

export function createPreviewManager({
  cwd = rootDir,
  logger = console,
}) {
  const child = spawn('pnpm', ['cf:preview'], {
    cwd,
    env: process.env,
    detached: process.platform !== 'win32',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const recentLogs = [];
  let stopping = false;

  function appendLog(chunk) {
    const text = chunk.toString();
    if (!stopping) {
      process.stdout.write(text);
    }
    recentLogs.push(text);
    if (recentLogs.length > 120) {
      recentLogs.shift();
    }
  }

  child.stdout?.on('data', appendLog);
  child.stderr?.on('data', appendLog);

  child.on('exit', (code, signal) => {
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

async function main() {
  const baseUrl = normalizePreviewBaseUrl(process.env.CF_PREVIEW_URL);
  const reuseServer = process.env.CF_PREVIEW_REUSE_SERVER === 'true';

  if (reuseServer) {
    console.log(`Reusing Cloudflare preview server: ${baseUrl}`);
    await runCloudflarePreviewSmoke({ baseUrl });
    console.log('Cloudflare preview DB smoke passed');
    return;
  }

  const preview = createPreviewManager({});

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
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
