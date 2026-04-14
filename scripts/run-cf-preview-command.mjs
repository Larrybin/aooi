import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);

function resolveWranglerConfigPath() {
  const cliArgs = process.argv.slice(2);
  const configIndex = cliArgs.findIndex((arg) => arg === '--config');

  if (configIndex !== -1) {
    const configPath = cliArgs[configIndex + 1]?.trim();
    if (!configPath) {
      throw new Error('--config requires a value');
    }
    return configPath;
  }

  const envConfigPath = process.env.CF_PREVIEW_WRANGLER_CONFIG_PATH?.trim();
  if (envConfigPath) {
    return envConfigPath;
  }

  return path.resolve(rootDir, 'wrangler.cloudflare.toml');
}

async function runCommand(command, args, { allowRunning = false } = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });

  if (!allowRunning && exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${exitCode}`);
  }

  process.exitCode = exitCode;
}

async function main() {
  const wranglerConfigPath = resolveWranglerConfigPath();

  await runCommand('pnpm', ['cf:check']);
  await runCommand('pnpm', ['cf:build']);
  await runCommand(
    'pnpm',
    ['exec', 'opennextjs-cloudflare', 'preview', '--config', wranglerConfigPath],
    { allowRunning: true }
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
