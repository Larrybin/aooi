import { once } from 'node:events';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createPreviewManager,
  waitForPreviewReady,
} from './run-cf-preview-smoke.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

const DEFAULT_NODE_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_CF_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_AUTH_SPIKE_SECRET =
  'local-auth-spike-secret-0123456789abcdef';
const NODE_READY_TIMEOUT_MS = Number.parseInt(
  process.env.AUTH_SPIKE_NODE_READY_TIMEOUT_MS || '180000',
  10
);
const REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.AUTH_SPIKE_REQUEST_TIMEOUT_MS || '30000',
  10
);
const POLL_INTERVAL_MS = 1000;

export function readWranglerLocalConnectionString(content) {
  const match = content.match(
    /\[\[hyperdrive\]\][\s\S]*?^\s*localConnectionString\s*=\s*"([^"\n]+)"/m
  );
  if (!match?.[1]?.trim()) {
    throw new Error(
      'wrangler.toml 缺少 [[hyperdrive]].localConnectionString，无法为本地 Node auth spike 提供 DATABASE_URL'
    );
  }
  return match[1].trim();
}

export function buildNodeAuthSpikeEnv(baseEnv, options) {
  const appUrl = options.appUrl || DEFAULT_NODE_BASE_URL;
  const authSecret = options.authSecret || DEFAULT_AUTH_SPIKE_SECRET;

  return {
    ...baseEnv,
    VERCEL: '1',
    DATABASE_URL: options.databaseUrl,
    DB_SINGLETON_ENABLED: 'false',
    NEXT_PUBLIC_APP_URL: appUrl,
    BETTER_AUTH_URL: appUrl,
    AUTH_URL: appUrl,
    BETTER_AUTH_SECRET: authSecret,
    AUTH_SECRET: authSecret,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function killChild(child, signal) {
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

export async function waitForNodeReady({
  baseUrl = DEFAULT_NODE_BASE_URL,
  fetchImpl = fetch,
  timeoutMs = NODE_READY_TIMEOUT_MS,
  logger = console,
}) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchImpl(`${baseUrl}/sign-in`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 200) {
        logger.log(`✓ Local Node auth surface ready: ${baseUrl}`);
        return;
      }

      lastError = new Error(`readiness returned ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Local Node auth surface not ready within ${timeoutMs}ms: ${lastError?.message || 'unknown error'}`
  );
}

export function createNodeDevManager({
  cwd = rootDir,
  env = process.env,
  port = 3000,
  logger = console,
}) {
  const child = spawn(
    'pnpm',
    ['exec', 'next', 'dev', '--turbopack', '--port', String(port)],
    {
      cwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

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
      logger.error(`Local Node auth surface exited early with code ${code}`);
    } else if (signal) {
      logger.error(`Local Node auth surface exited via signal ${signal}`);
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
      killChild(child, 'SIGINT');
      const exitedAfterSigint = await waitForChildExit(child, 10_000);

      if (!exitedAfterSigint && child.exitCode === null) {
        killChild(child, 'SIGKILL');
        await waitForChildExit(child, 5_000);
      }
    },
  };
}

async function waitForManagerReady({
  label,
  manager,
  ready,
}) {
  const readyPromise = ready();
  const exitPromise = once(manager.child, 'exit').then(([code, signal]) => {
    const recentLogs = manager.recentLogs.join('').trim();
    const details = recentLogs ? `\nRecent logs:\n${recentLogs}` : '';
    throw new Error(
      `${label} exited before readiness (code=${code ?? 'null'}, signal=${signal ?? 'null'})${details}`
    );
  });

  return Promise.race([readyPromise, exitPromise]);
}

async function ensureCiDevVars(authSecret) {
  const devVarsPath = path.resolve(rootDir, '.dev.vars');

  try {
    await readFile(devVarsPath, 'utf8');
    return { created: false, devVarsPath };
  } catch {
    const content = `AUTH_SECRET=${authSecret}\nBETTER_AUTH_SECRET=${authSecret}\n`;
    await writeFile(devVarsPath, content, 'utf8');
    return { created: true, devVarsPath };
  }
}

async function main() {
  const wranglerContent = await readFile(
    path.resolve(rootDir, 'wrangler.toml'),
    'utf8'
  );
  const databaseUrl =
    process.env.AUTH_SPIKE_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    readWranglerLocalConnectionString(wranglerContent);
  const authSecret =
    process.env.BETTER_AUTH_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    DEFAULT_AUTH_SPIKE_SECRET;
  const nodeBaseUrl =
    process.env.AUTH_SPIKE_LOCAL_VERCEL_URL?.trim() || DEFAULT_NODE_BASE_URL;
  const cloudflareBaseUrl =
    process.env.AUTH_SPIKE_LOCAL_CF_URL?.trim() || DEFAULT_CF_BASE_URL;
  const nodePort =
    Number.parseInt(new URL(nodeBaseUrl).port || '3000', 10) || 3000;

  const nodeEnv = buildNodeAuthSpikeEnv(process.env, {
    databaseUrl,
    authSecret,
    appUrl: nodeBaseUrl,
  });

  const devVars = await ensureCiDevVars(authSecret);
  const nodeManager = createNodeDevManager({ env: nodeEnv, port: nodePort });
  const previewManager = createPreviewManager({ env: process.env });

  try {
    await Promise.all([
      waitForManagerReady({
        label: 'Local Node auth surface',
        manager: nodeManager,
        ready: () => waitForNodeReady({ baseUrl: nodeBaseUrl }),
      }),
      waitForManagerReady({
        label: 'Cloudflare preview',
        manager: previewManager,
        ready: () => waitForPreviewReady({ baseUrl: cloudflareBaseUrl }),
      }),
    ]);

    const child = spawn(
      process.execPath,
      ['--import', 'tsx', 'scripts/run-auth-spike.mjs'],
      {
        cwd: rootDir,
        env: {
          ...process.env,
          AUTH_SPIKE_VERCEL_URL: nodeBaseUrl,
          AUTH_SPIKE_CF_URL: cloudflareBaseUrl,
          AUTH_SPIKE_EMAIL:
            process.env.AUTH_SPIKE_EMAIL?.trim() || 'auth-spike@example.com',
          AUTH_SPIKE_PASSWORD:
            process.env.AUTH_SPIKE_PASSWORD?.trim() || 'AuthSpike123!auth',
          AUTH_SPIKE_CALLBACK_PATH:
            process.env.AUTH_SPIKE_CALLBACK_PATH?.trim() ||
            '/settings/profile',
        },
        stdio: 'inherit',
      }
    );

    const exitCode = await new Promise((resolve) => {
      child.on('exit', (code) => resolve(code ?? 1));
    });

    process.exit(typeof exitCode === 'number' ? exitCode : 1);
  } finally {
    await Promise.allSettled([previewManager.stop(), nodeManager.stop()]);

    if (devVars.created) {
      await rm(devVars.devVarsPath, { force: true });
    }
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
