import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { resolvePostDeploySmokeUrl } from './run-cf-multi-deploy.mjs';
import cloudflareWorkerSplits from '../src/shared/config/cloudflare-worker-splits.ts';

const { CLOUDFLARE_ROUTER_WORKER_NAME } = cloudflareWorkerSplits;

const rootDir = process.cwd();
const routerConfigPath = path.resolve(rootDir, 'wrangler.cloudflare.toml');

function log(message) {
  console.log(`[cf:migration] ${message}`);
}

export function createDeployMessage(label = 'migration-deploy') {
  return `${label}-${new Date().toISOString().replaceAll(':', '-')}`;
}

export function buildMigrationDeployWranglerArgs({
  name = CLOUDFLARE_ROUTER_WORKER_NAME,
  configPath,
  secretsPath,
  message = createDeployMessage(),
}) {
  return [
    'deploy',
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    message,
    '--keep-vars',
    '--secrets-file',
    secretsPath,
  ];
}

function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'wrangler', ...args], {
      cwd: rootDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const value = chunk.toString();
      stdout += value;
      process.stdout.write(value);
    });

    child.stderr.on('data', (chunk) => {
      const value = chunk.toString();
      stderr += value;
      process.stderr.write(value);
    });

    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `wrangler ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`
          )
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function createMigrationDeployArtifacts() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-router-migration-'));
  const secretsPath = path.join(tempDir, 'router.secrets.env');
  await writeCloudflareSecretsFile({ outputPath: secretsPath });

  return {
    configPath: routerConfigPath,
    secretsPath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function runPostDeploySmoke() {
  log('running post-deploy smoke');
  const routerConfigContent = await readFile(routerConfigPath, 'utf8');
  const smokeUrl = resolvePostDeploySmokeUrl({ routerConfigContent });
  const smokeExitCode = await new Promise((resolve) => {
    const child = spawn('pnpm', ['test:cf-app-smoke'], {
      cwd: rootDir,
      env: {
        ...process.env,
        CF_APP_SMOKE_URL: smokeUrl,
      },
      stdio: 'inherit',
    });

    child.once('error', () => resolve(1));
    child.once('exit', (code) => resolve(code ?? 1));
  });

  if (smokeExitCode !== 0) {
    throw new Error('post-deploy Cloudflare smoke failed');
  }
}

export async function deployCloudflareMigration({
  createArtifacts = createMigrationDeployArtifacts,
  runWranglerCommand = runWrangler,
  runSmoke = runPostDeploySmoke,
} = {}) {
  const artifacts = await createArtifacts();

  try {
    log(`deploying ${CLOUDFLARE_ROUTER_WORKER_NAME} migration release`);
    await runWranglerCommand(
      buildMigrationDeployWranglerArgs({
        configPath: artifacts.configPath,
        secretsPath: artifacts.secretsPath,
      })
    );
    await runSmoke();
  } finally {
    await artifacts.cleanup();
  }
}

const entryScriptPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entryScriptPath === import.meta.url) {
  deployCloudflareMigration().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
