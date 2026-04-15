import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { writeCloudflareSecretsFile } from './create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from './create-cf-wrangler-config.mjs';
import cloudflareWorkerSplits from '../src/shared/config/cloudflare-worker-splits.ts';

const {
  CLOUDFLARE_ROUTER_WORKER_NAME,
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_SERVER_WORKERS,
  CLOUDFLARE_VERSION_ID_VARS,
  getServerWorkerMetadata,
} = cloudflareWorkerSplits;

const rootDir = process.cwd();
const uploadOrder = CLOUDFLARE_ALL_SERVER_WORKER_TARGETS;
const routerConfigPath = path.resolve(rootDir, 'wrangler.cloudflare.toml');
const serverConfigPaths = Object.fromEntries(
  uploadOrder.map((target) => [
    target,
    path.resolve(rootDir, getServerWorkerMetadata(target).wranglerConfigRelativePath),
  ])
);

function log(message) {
  console.log(`[cf:deploy] ${message}`);
}

function runWrangler(args, { allowFailure = false } = {}) {
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
      if (code !== 0 && !allowFailure) {
        reject(
          new Error(
            `wrangler ${args.join(' ')} exited with code ${code}\n${stderr || stdout}`
          )
        );
        return;
      }

      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseUploadedVersionId(output) {
  const explicitMatch = output.match(
    /(?:Worker Version ID|version id)[^0-9a-f]*([0-9a-f-]{36})/i
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1];
  }

  const fallbackMatch = output.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i);
  if (fallbackMatch?.[0]) {
    return fallbackMatch[0];
  }

  throw new Error(`Could not parse worker version id from output:\n${output}`);
}

function collectVersionCandidates(value, out = []) {
  if (!value) {
    return out;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectVersionCandidates(entry, out);
    }
    return out;
  }

  if (typeof value !== 'object') {
    return out;
  }

  const record = value;
  const candidateId =
    pickString(record, ['version_id', 'versionId', 'id']) ?? null;
  const percentage = pickNumber(record, [
    'percentage',
    'traffic_percentage',
    'trafficPercentage',
  ]);

  if (candidateId && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(candidateId)) {
    out.push({
      id: candidateId,
      percentage,
    });
  }

  for (const nestedValue of Object.values(record)) {
    collectVersionCandidates(nestedValue, out);
  }

  return out;
}

function pickString(record, keys) {
  for (const key of keys) {
    if (typeof record[key] === 'string' && record[key].trim()) {
      return record[key].trim();
    }
  }

  return null;
}

function pickNumber(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function parseWranglerJsonPayload(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return null;
  }

  const firstArrayIndex = trimmed.indexOf('[');
  const lastArrayIndex = trimmed.lastIndexOf(']');
  if (firstArrayIndex >= 0 && lastArrayIndex > firstArrayIndex) {
    return JSON.parse(trimmed.slice(firstArrayIndex, lastArrayIndex + 1));
  }

  const firstObjectIndex = trimmed.indexOf('{');
  const lastObjectIndex = trimmed.lastIndexOf('}');
  if (firstObjectIndex >= 0 && lastObjectIndex > firstObjectIndex) {
    return JSON.parse(trimmed.slice(firstObjectIndex, lastObjectIndex + 1));
  }

  return null;
}

async function readCurrentVersionId(name, configPath) {
  const result = await runWrangler(
    ['deployments', 'status', '--json', '--config', configPath, '--name', name],
    { allowFailure: true }
  );

  if (result.code !== 0 || !result.stdout.trim()) {
    return null;
  }

  try {
    const payload = parseWranglerJsonPayload(result.stdout) ?? JSON.parse(result.stdout);
    const candidates = collectVersionCandidates(payload)
      .filter((candidate, index, all) => {
        return all.findIndex((entry) => entry.id === candidate.id) === index;
      })
      .sort((left, right) => (right.percentage ?? -1) - (left.percentage ?? -1));

    return candidates[0]?.id ?? null;
  } catch {
    return null;
  }
}

function buildVersionSpec(versionId, percentage) {
  return `${versionId}@${percentage}%`;
}

function replaceQuotedTomlValue(content, key, nextValue) {
  const pattern = new RegExp(`(^\\s*${key}\\s*=\\s*")([^"\\n]*)(")`, 'm');
  return content.replace(pattern, `$1${nextValue}$3`);
}

function readQuotedTomlValue(content, key) {
  const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"\\n]*)"`, 'm'));
  return match?.[1]?.trim() || '';
}

export function buildVersionDeploySpecs(currentVersionId, nextVersionId) {
  return currentVersionId
    ? [buildVersionSpec(nextVersionId, 100), buildVersionSpec(currentVersionId, 0)]
    : [buildVersionSpec(nextVersionId, 100)];
}

export function buildRouterDeployConfigContent(content, versionIds) {
  return buildCloudflareWranglerConfig({
    template: content,
    templatePath: routerConfigPath,
    outputPath: path.resolve(rootDir, '.tmp/wrangler.cloudflare.router.deploy.toml'),
    versionVars: Object.fromEntries(
      uploadOrder.map((target) => [
        CLOUDFLARE_VERSION_ID_VARS[target],
        versionIds[target],
      ])
    ),
  });
}

export function resolvePostDeploySmokeUrl({
  processEnv = process.env,
  routerConfigContent,
} = {}) {
  return (
    processEnv.CF_APP_SMOKE_URL?.trim() ||
    processEnv.NEXT_PUBLIC_APP_URL?.trim() ||
    readQuotedTomlValue(routerConfigContent || '', 'NEXT_PUBLIC_APP_URL') ||
    ''
  );
}

export function determineDeployMode(currentVersions) {
  if (!currentVersions.router) {
    return 'bootstrap';
  }

  return uploadOrder.some((target) => !currentVersions.servers[target])
    ? 'bootstrap'
    : 'steady-state';
}

async function createTempDeployArtifacts({
  name,
  templatePath,
  versionIds,
}) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), `cf-${name}-`));
  const tempConfigPath = path.join(tempDir, `${name}.wrangler.toml`);
  const secretsPath = path.join(tempDir, `${name}.secrets.env`);
  const template = await readFile(templatePath, 'utf8');
  const content = buildCloudflareWranglerConfig({
    template,
    templatePath,
    outputPath: tempConfigPath,
    versionVars: versionIds
      ? Object.fromEntries(
          Object.entries(versionIds).map(([target, versionId]) => [
            CLOUDFLARE_VERSION_ID_VARS[target],
            versionId,
          ])
        )
      : {},
  });

  await writeFile(tempConfigPath, content, 'utf8');
  await writeCloudflareSecretsFile({ outputPath: secretsPath });

  return {
    tempDir,
    tempConfigPath,
    secretsPath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function deployWorkerBootstrap({ name, configPath, secretsPath }) {
  log(`bootstrapping ${name}`);
  await runWrangler([
    'deploy',
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    `bootstrap ${new Date().toISOString()}`,
    '--keep-vars',
    '--secrets-file',
    secretsPath,
  ]);
}

async function uploadWorkerVersion({ name, configPath, secretsPath }) {
  log(`uploading version for ${name}`);
  const result = await runWrangler([
    'versions',
    'upload',
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    `multi-worker deploy ${new Date().toISOString()}`,
    '--secrets-file',
    secretsPath,
  ]);
  const versionId = parseUploadedVersionId(`${result.stdout}\n${result.stderr}`);
  log(`uploaded ${name} version ${versionId}`);
  return versionId;
}

async function deployWorkerVersionSet({
  name,
  configPath,
  currentVersionId,
  nextVersionId,
}) {
  const specs = buildVersionDeploySpecs(currentVersionId, nextVersionId);

  log(`deploying ${name}: ${specs.join(', ')}`);
  await runWrangler([
    'versions',
    'deploy',
    ...specs,
    '--config',
    configPath,
    '--name',
    name,
    '--message',
    `multi-worker rollout ${new Date().toISOString()}`,
    '--yes',
  ]);
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

async function collectCurrentVersions() {
  const versions = {};

  for (const target of uploadOrder) {
    versions[target] = await readCurrentVersionId(
      CLOUDFLARE_SERVER_WORKERS[target],
      serverConfigPaths[target]
    );
  }

  return {
    router: await readCurrentVersionId(
      CLOUDFLARE_ROUTER_WORKER_NAME,
      routerConfigPath
    ),
    servers: versions,
  };
}

function isBootstrapRequired(currentVersions) {
  return determineDeployMode(currentVersions) === 'bootstrap';
}

async function bootstrapAllWorkers() {
  const routerArtifacts = [];
  const serverArtifacts = [];
  const currentVersions = {};

  try {
    for (const target of uploadOrder) {
      const name = CLOUDFLARE_SERVER_WORKERS[target];
      const artifacts = await createTempDeployArtifacts({
        name,
        templatePath: serverConfigPaths[target],
      });
      serverArtifacts.push(artifacts);
      await deployWorkerBootstrap({
        name,
        configPath: artifacts.tempConfigPath,
        secretsPath: artifacts.secretsPath,
      });
      const currentVersionId = await readCurrentVersionId(name, artifacts.tempConfigPath);
      if (!currentVersionId) {
        throw new Error(`bootstrap failed to resolve deployed version for ${name}`);
      }
      currentVersions[target] = currentVersionId;
    }

    const routerArtifactsEntry = await createTempDeployArtifacts({
      name: CLOUDFLARE_ROUTER_WORKER_NAME,
      templatePath: routerConfigPath,
      versionIds: currentVersions,
    });
    routerArtifacts.push(routerArtifactsEntry);
    await deployWorkerBootstrap({
      name: CLOUDFLARE_ROUTER_WORKER_NAME,
      configPath: routerArtifactsEntry.tempConfigPath,
      secretsPath: routerArtifactsEntry.secretsPath,
    });

    await runPostDeploySmoke();
  } finally {
    for (const artifacts of [...serverArtifacts, ...routerArtifacts]) {
      await artifacts.cleanup();
    }
  }
}

async function deploySteadyState(currentVersions) {
  const serverArtifacts = [];
  let routerArtifacts = null;

  try {
    const nextVersions = {};

    for (const target of uploadOrder) {
      const name = CLOUDFLARE_SERVER_WORKERS[target];
      const artifacts = await createTempDeployArtifacts({
        name,
        templatePath: serverConfigPaths[target],
      });
      serverArtifacts.push({ target, ...artifacts });
      nextVersions[target] = await uploadWorkerVersion({
        name,
        configPath: artifacts.tempConfigPath,
        secretsPath: artifacts.secretsPath,
      });
    }

    routerArtifacts = await createTempDeployArtifacts({
      name: CLOUDFLARE_ROUTER_WORKER_NAME,
      templatePath: routerConfigPath,
      versionIds: nextVersions,
    });
    const nextRouterVersionId = await uploadWorkerVersion({
      name: CLOUDFLARE_ROUTER_WORKER_NAME,
      configPath: routerArtifacts.tempConfigPath,
      secretsPath: routerArtifacts.secretsPath,
    });

    await deployWorkerVersionSet({
      name: CLOUDFLARE_ROUTER_WORKER_NAME,
      configPath: routerArtifacts.tempConfigPath,
      currentVersionId: currentVersions.router,
      nextVersionId: nextRouterVersionId,
    });

    for (const { target, tempConfigPath } of serverArtifacts) {
      await deployWorkerVersionSet({
        name: CLOUDFLARE_SERVER_WORKERS[target],
        configPath: tempConfigPath,
        currentVersionId: currentVersions.servers[target],
        nextVersionId: nextVersions[target],
      });
    }

    await runWrangler(
      ['types', '--config', routerConfigPath, '--env-interface', 'CloudflareEnv', 'src/shared/types/cloudflare.d.ts'],
      {
        allowFailure: true,
      }
    );

    await runPostDeploySmoke();
  } finally {
    for (const artifacts of serverArtifacts) {
      await artifacts.cleanup();
    }

    if (routerArtifacts) {
      await routerArtifacts.cleanup();
    }
  }
}

async function main() {
  const currentVersions = await collectCurrentVersions();

  if (isBootstrapRequired(currentVersions)) {
    log('detected brand-new or partially initialized Cloudflare workers; entering bootstrap flow');
    await bootstrapAllWorkers();
    return;
  }

  log('detected existing deployments for router and all server workers; entering steady-state rollout');
  await deploySteadyState(currentVersions);
}

const entryScriptPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (entryScriptPath === import.meta.url) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
