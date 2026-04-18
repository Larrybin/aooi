import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
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

async function requestGracefulProcessShutdown(child, gracefulStopInput) {
  if (!gracefulStopInput || !child.stdin || child.stdin.destroyed) {
    return false;
  }

  try {
    child.stdin.write(gracefulStopInput);
  } catch {
    return false;
  }

  return waitForChildExit(child, 5_000);
}

function killProcess(child, signal) {
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

export function createReadyProcessManager({
  label,
  command = 'pnpm',
  args,
  cwd = rootDir,
  env = process.env,
  logger = console,
  gracefulStopInput = null,
}) {
  const child = spawn(command, args, {
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
  readyUrlPromise.catch(() => undefined);

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
    logger.log(`Detected ${label} ready URL: ${nextReadyUrl}`);
  }

  child.stdout?.on('data', appendLog);
  child.stderr?.on('data', appendLog);

  child.on('exit', (code, signal) => {
    if (!readyUrl) {
      rejectReadyUrl(
        new Error(
          `${label} exited before emitting a ready URL (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
        )
      );
    }

    if (stopping) {
      return;
    }

    if (code !== null && code !== 0) {
      logger.error(`${label} exited early with code ${code}`);
    } else if (signal) {
      logger.error(`${label} exited via signal ${signal}`);
    }
  });

  return {
    label,
    child,
    recentLogs,
    readyUrlPromise,
    async stop() {
      if (child.exitCode !== null) {
        return;
      }

      stopping = true;

      const exitedGracefully = await requestGracefulProcessShutdown(
        child,
        gracefulStopInput
      );
      if (exitedGracefully) {
        return;
      }

      killProcess(child, 'SIGINT');

      const exitedAfterSigint = await waitForChildExit(child, 10_000);
      if (!exitedAfterSigint && child.exitCode === null) {
        killProcess(child, 'SIGKILL');
        await waitForChildExit(child, 5_000);
      }
    },
  };
}

export function createPreviewManager({
  cwd = rootDir,
  env = process.env,
  logger = console,
  wranglerConfigPath,
}) {
  const args = ['exec', 'opennextjs-cloudflare', 'preview'];
  if (wranglerConfigPath) {
    args.push('--config', wranglerConfigPath);
  }

  return createReadyProcessManager({
    label: 'Cloudflare preview',
    args,
    cwd,
    env,
    logger,
    gracefulStopInput: 'x',
  });
}

export function buildWranglerDevArgs({
  wranglerConfigPath,
  port,
  inspectorPort,
  name,
  persistTo,
}) {
  const args = ['exec', 'wrangler', 'dev'];
  if (wranglerConfigPath) {
    args.push('--config', wranglerConfigPath);
  }
  if (name) {
    args.push('--name', name);
  }
  if (persistTo) {
    args.push('--persist-to', persistTo);
  }
  args.push(
    '--local',
    '--port',
    String(port),
    '--inspector-port',
    String(inspectorPort),
    '--show-interactive-dev-session=false'
  );

  return args;
}

export function createWranglerDevManager({
  label,
  cwd = rootDir,
  env = process.env,
  logger = console,
  wranglerConfigPath,
  port,
  inspectorPort,
  name,
  persistTo,
}) {
  const args = buildWranglerDevArgs({
    wranglerConfigPath,
    port,
    inspectorPort,
    name,
    persistTo,
  });

  return createReadyProcessManager({
    label,
    args,
    cwd,
    env,
    logger,
  });
}

export function resolveAuthSecret(
  processEnv = process.env,
  fallbackAuthSecret = 'ci-auth-secret-not-for-production'
) {
  return (
    processEnv.BETTER_AUTH_SECRET?.trim() ||
    processEnv.AUTH_SECRET?.trim() ||
    fallbackAuthSecret
  );
}

export async function ensureCiDevVars({
  authSecret,
  extraVars = {},
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
  for (const [name, value] of Object.entries(extraVars)) {
    nextContent = upsertDevVar(nextContent, name, value);
  }

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

  if (content.endsWith('\n')) {
    return `${content}${line}\n`;
  }

  return `${content}\n${line}\n`;
}
