import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import cloudflareWorkerSplits from '../src/shared/config/cloudflare-worker-splits.ts';

const { CLOUDFLARE_STATE_WORKER, CLOUDFLARE_STATE_WORKER_NAME } =
  cloudflareWorkerSplits;

const rootDir = process.cwd();
const stateConfigPath = path.resolve(
  rootDir,
  CLOUDFLARE_STATE_WORKER.wranglerConfigRelativePath
);
const storagePublicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL?.trim();

function log(message) {
  console.log(`[cf:deploy:state] ${message}`);
}

export function createDeployMessage(label = 'state-deploy') {
  return `${label}-${new Date().toISOString().replaceAll(':', '-')}`;
}

export function buildStateDeployWranglerArgs({
  name = CLOUDFLARE_STATE_WORKER_NAME,
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
    '--experimental-autoconfig=false',
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

async function createStateDeployArtifacts() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-state-deploy-'));
  const tempConfigPath = path.join(tempDir, 'wrangler.state.toml');
  const secretsPath = path.join(tempDir, 'state.secrets.env');
  const template = await readFile(stateConfigPath, 'utf8');
  const content = buildCloudflareWranglerConfig({
    template,
    storagePublicBaseUrl,
    templatePath: stateConfigPath,
    outputPath: tempConfigPath,
    validateTemplateContract: true,
  });

  await writeFile(tempConfigPath, content, 'utf8');
  await writeCloudflareSecretsFile({ outputPath: secretsPath });

  return {
    configPath: tempConfigPath,
    secretsPath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

export async function deployCloudflareState({
  createArtifacts = createStateDeployArtifacts,
  runWranglerCommand = runWrangler,
} = {}) {
  const artifacts = await createArtifacts();

  try {
    log(`deploying ${CLOUDFLARE_STATE_WORKER_NAME} via wrangler deploy`);
    await runWranglerCommand(
      buildStateDeployWranglerArgs({
        configPath: artifacts.configPath,
        secretsPath: artifacts.secretsPath,
      })
    );
  } finally {
    await artifacts.cleanup();
  }
}

const entryScriptPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entryScriptPath === import.meta.url) {
  deployCloudflareState().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
