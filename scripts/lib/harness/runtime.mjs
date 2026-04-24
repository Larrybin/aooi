import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';

export function createTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '');
}

export function readCommitShaSafely(cwd) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForChildExit(child, timeoutMs) {
  if (!child || child.exitCode !== null) {
    return true;
  }

  const exitPromise = once(child, 'exit')
    .then(() => true)
    .catch(() => false);

  return Promise.race([exitPromise, sleep(timeoutMs).then(() => false)]);
}

export function killChild(child, signal) {
  if (!child?.pid) {
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

export async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  killChild(child, 'SIGINT');
  const exited = await waitForChildExit(child, 10_000);
  if (!exited && child.exitCode === null) {
    killChild(child, 'SIGKILL');
    await waitForChildExit(child, 5_000);
  }
}

export async function waitForManagerReady({ label, manager, ready }) {
  const readyPromise = ready();
  const exitPromise = once(manager.child, 'exit').then(([code, signal]) => {
    const recentLogs = Array.isArray(manager.recentLogs)
      ? manager.recentLogs.join('').trim()
      : '';
    const details = recentLogs ? `\nRecent logs:\n${recentLogs}` : '';
    throw new Error(
      `${label} exited before readiness (code=${code ?? 'null'}, signal=${signal ?? 'null'})${details}`
    );
  });

  return Promise.race([readyPromise, exitPromise]);
}

export async function runNodeScript({
  cwd,
  scriptPath,
  args = [],
  env,
  stdio = 'inherit',
}) {
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', scriptPath, ...args],
    {
      cwd,
      env,
      stdio,
    }
  );

  const exitCode = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    throw new Error(`${scriptPath} exited with code ${exitCode}`);
  }
}
