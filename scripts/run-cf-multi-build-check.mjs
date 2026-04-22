import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import cloudflareWorkerSplits from '../src/shared/config/cloudflare-worker-splits.ts';

const {
  CLOUDFLARE_STATE_WORKER,
  CLOUDFLARE_STATE_WORKER_NAME,
  CLOUDFLARE_ROUTER_WORKER_NAME,
  CLOUDFLARE_ROUTER_WORKER,
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_SERVER_WORKERS,
  getServerWorkerMetadata,
} = cloudflareWorkerSplits;

const rootDir = process.cwd();
const fallbackBuildSecret = 'cf-build-dry-run-secret-0123456789abcdef';
const uploadTargets = [
  {
    label: 'state',
    name: CLOUDFLARE_STATE_WORKER_NAME,
    configPath: path.resolve(rootDir, CLOUDFLARE_STATE_WORKER.wranglerConfigRelativePath),
    dryRunCommand: 'deploy',
  },
  {
    label: 'router',
    name: CLOUDFLARE_ROUTER_WORKER_NAME,
    configPath: path.resolve(rootDir, CLOUDFLARE_ROUTER_WORKER.wranglerConfigRelativePath),
    dryRunCommand: 'versions-upload',
  },
  ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => ({
    label: target,
    name: CLOUDFLARE_SERVER_WORKERS[target],
    configPath: path.resolve(
      rootDir,
      getServerWorkerMetadata(target).wranglerConfigRelativePath
    ),
    dryRunCommand: 'versions-upload',
  })),
];

function fail(message) {
  console.error(`[cf:build] ${message}`);
  process.exit(1);
}

function formatSizeKiB(kib) {
  return {
    kib: kib.toFixed(2),
    mib: (kib / 1024).toFixed(2),
  };
}

function formatSizeBytes(bytes) {
  return {
    bytes,
    kib: (bytes / 1024).toFixed(2),
    mib: (bytes / 1024 / 1024).toFixed(2),
  };
}

export function parseDryRunUploadSize(output) {
  const match = output.match(
    /Total Upload:\s*([0-9.]+)\s*KiB\s*\/\s*gzip:\s*([0-9.]+)\s*KiB/i
  );
  if (!match?.[1] || !match?.[2]) {
    throw new Error(`Could not parse dry-run upload size from output:\n${output}`);
  }

  return {
    totalKiB: Number.parseFloat(match[1]),
    gzipKiB: Number.parseFloat(match[2]),
  };
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

async function assertBundleExists(target) {
  if (target.label === 'router') {
    const workerPath = path.resolve(rootDir, '.open-next/worker.js');
    if (!fs.existsSync(workerPath)) {
      fail(`missing ${path.relative(rootDir, workerPath)}`);
    }
    return;
  }

  if (target.label === 'state') {
    const workerPath = path.resolve(
      rootDir,
      CLOUDFLARE_STATE_WORKER.workerEntryRelativePath
    );
    if (!fs.existsSync(workerPath)) {
      fail(`missing ${path.relative(rootDir, workerPath)}`);
    }
    return;
  }

  const metadata = getServerWorkerMetadata(target.label);
  const handlerPath = path.resolve(
    rootDir,
    path.join(path.dirname(metadata.bundleEntryRelativePath), 'handler.mjs')
  );
  if (!fs.existsSync(handlerPath)) {
    fail(`missing ${path.relative(rootDir, handlerPath)}`);
  }
}

export function buildStateDryRunArgs({ configPath, secretsPath, name }) {
  return [
    'deploy',
    '--dry-run',
    '--config',
    configPath,
    '--name',
    name,
    '--keep-vars',
    '--secrets-file',
    secretsPath,
  ];
}

export function buildVersionUploadDryRunArgs({ configPath, secretsPath, name }) {
  return [
    'versions',
    'upload',
    '--dry-run',
    '--config',
    configPath,
    '--name',
    name,
    '--secrets-file',
    secretsPath,
  ];
}

async function readServerBundleDiagnostics(target) {
  const metadata = getServerWorkerMetadata(target);
  const handlerPath = path.resolve(
    rootDir,
    path.join(path.dirname(metadata.bundleEntryRelativePath), 'handler.mjs')
  );
  const metaPath = `${handlerPath}.meta.json`;
  const handlerStats = await fs.promises.stat(handlerPath);
  const handlerSize = formatSizeBytes(handlerStats.size);

  let topInputsSummary = 'meta unavailable';
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(await readFile(metaPath, 'utf8'));
    const topInputs = Object.entries(meta.inputs || {})
      .map(([inputPath, inputMeta]) => ({
        inputPath,
        bytes:
          inputMeta && typeof inputMeta === 'object' && 'bytes' in inputMeta
            ? Number(inputMeta.bytes) || 0
            : 0,
      }))
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 5)
      .map(
        ({ inputPath, bytes }) =>
          `${path.basename(inputPath)}=${(bytes / 1024).toFixed(1)}KiB`
      );

    if (topInputs.length > 0) {
      topInputsSummary = topInputs.join(', ');
    }
  }

  return {
    handlerPath,
    handlerSize,
    topInputsSummary,
  };
}

async function main() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'cf-build-dry-run-'));
  const emptyAssetsDir = path.join(tempDir, 'assets');
  const secretsPath = path.join(tempDir, 'cloudflare.secrets.env');

  try {
    await mkdir(emptyAssetsDir, { recursive: true });
    await writeCloudflareSecretsFile({
      outputPath: secretsPath,
      fallbackAuthSecret: fallbackBuildSecret,
    });

    for (const target of uploadTargets) {
      await assertBundleExists(target);
      const tempConfigPath = path.join(tempDir, `${target.label}.wrangler.toml`);
      const template = await readFile(target.configPath, 'utf8');
      const generatedConfig = buildCloudflareWranglerConfig({
        template,
        templatePath: target.configPath,
        outputPath: tempConfigPath,
        validateTemplateContract: true,
      }).replace(
        /(^\s*directory\s*=\s*")([^"\n]*)(")/m,
        `$1${emptyAssetsDir}$3`
      );
      await writeFile(tempConfigPath, generatedConfig, 'utf8');
      const result = await runWrangler(
        target.dryRunCommand === 'deploy'
          ? buildStateDryRunArgs({
              configPath: tempConfigPath,
              name: target.name,
              secretsPath,
            })
          : buildVersionUploadDryRunArgs({
              configPath: tempConfigPath,
              name: target.name,
              secretsPath,
            })
      );
      const sizes = parseDryRunUploadSize(`${result.stdout}\n${result.stderr}`);
      const formatted = formatSizeKiB(sizes.gzipKiB);
      const diagnostics =
        target.label === 'router' || target.label === 'state'
          ? null
          : await readServerBundleDiagnostics(target.label);

      console.log(
        `[cf:build] ${target.label}: gzip ${formatted.kib} KiB / ${formatted.mib} MiB (total ${sizes.totalKiB.toFixed(2)} KiB)`
      );
      if (diagnostics) {
        console.log(
          `[cf:build] ${target.label}: raw handler ${diagnostics.handlerSize.kib} KiB / ${diagnostics.handlerSize.mib} MiB (${path.relative(rootDir, diagnostics.handlerPath)})`
        );
        console.log(
          `[cf:build] ${target.label}: top inputs ${diagnostics.topInputsSummary}`
        );
      }

      if (sizes.gzipKiB >= 3 * 1024) {
        fail(
          `${target.label} deployable bundle is ${formatted.mib} MiB gzip; limit is 3.00 MiB`
        );
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

const entryScriptPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : null;

if (
  entryScriptPath &&
  path.resolve(fileURLToPath(import.meta.url)) === entryScriptPath
) {
  main().catch((error) => {
    fail(error instanceof Error ? error.stack || error.message : String(error));
  });
}
