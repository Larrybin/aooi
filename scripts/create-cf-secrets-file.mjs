import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as envContractNamespace from '../src/config/env-contract.ts';
import {
  collectRequiredRuntimeBindings,
  normalizeCloudflareWorkerKeys,
  readCloudflareRuntimeSettings,
  resolveCloudflareWorkerKeys,
} from './lib/cloudflare-runtime-bindings.mjs';

const envContractModule = envContractNamespace.default ?? envContractNamespace;
const { assertAllowedEnvKeys, CLOUDFLARE_SECRET_ENV_KEYS } = envContractModule;

const rootDir = process.cwd();

export const CLOUDFLARE_SECRET_NAMES = [...CLOUDFLARE_SECRET_ENV_KEYS];

export function resolveCloudflareAuthSecretValue(
  processEnv = process.env,
  { fallbackAuthSecret } = {}
) {
  const betterAuthSecret = processEnv.BETTER_AUTH_SECRET?.trim();
  if (betterAuthSecret) {
    return betterAuthSecret;
  }

  const authSecret = processEnv.AUTH_SECRET?.trim();
  if (authSecret) {
    return authSecret;
  }

  if (fallbackAuthSecret?.trim()) {
    return fallbackAuthSecret.trim();
  }

  throw new Error(
    'BETTER_AUTH_SECRET or AUTH_SECRET is required to build Cloudflare secrets'
  );
}

function resolveRequiredSecretValue(processEnv, name, fallbackValue) {
  const value = processEnv[name]?.trim();
  if (value) {
    return value;
  }

  if (fallbackValue?.trim()) {
    return fallbackValue.trim();
  }

  throw new Error(`${name} is required to build Cloudflare secrets`);
}

function buildSecretFallbacks(requiredRequirements, processEnv, options) {
  const secretFallbacks = new Map();
  const needsAuthSecret = requiredRequirements.some(
    (requirement) =>
      requirement.name === 'BETTER_AUTH_SECRET' ||
      requirement.name === 'AUTH_SECRET'
  );

  if (!needsAuthSecret) {
    return secretFallbacks;
  }

  const authSecret = resolveCloudflareAuthSecretValue(processEnv, options);
  secretFallbacks.set('BETTER_AUTH_SECRET', authSecret);
  secretFallbacks.set('AUTH_SECRET', authSecret);
  return secretFallbacks;
}

export function buildCloudflareSecretsEnv(
  processEnv = process.env,
  options = {}
) {
  const workerKeys = normalizeCloudflareWorkerKeys(options.workerKeys);
  const runtimeSettings =
    options.runtimeSettings ??
    readCloudflareRuntimeSettings({
      processEnv,
      rootDir: options.rootDir ?? process.cwd(),
    });
  const requiredRequirements = collectRequiredRuntimeBindings(
    workerKeys,
    runtimeSettings
  );
  const requiredSecretNames = Array.from(
    new Set(requiredRequirements.map((requirement) => requirement.name))
  );
  const secretFallbacks = buildSecretFallbacks(
    requiredRequirements,
    processEnv,
    options
  );
  const resolvedSecrets = Object.fromEntries(
    requiredSecretNames.map((name) => [
      name,
      resolveRequiredSecretValue(processEnv, name, secretFallbacks.get(name)),
    ])
  );

  assertAllowedEnvKeys(
    resolvedSecrets,
    CLOUDFLARE_SECRET_NAMES,
    'Cloudflare secrets env'
  );

  return `${requiredSecretNames.map((name) => `${name}=${resolvedSecrets[name]}`).join('\n')}\n`;
}

export async function writeCloudflareSecretsFile({
  outputPath = path.resolve(rootDir, '.tmp/cloudflare.secrets.env'),
  processEnv = process.env,
  fallbackAuthSecret,
  workerKeys,
  rootDir: runtimeRootDir,
} = {}) {
  const content = buildCloudflareSecretsEnv(processEnv, {
    fallbackAuthSecret,
    workerKeys,
    rootDir: runtimeRootDir,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, content, 'utf8');

  return {
    outputPath,
    content,
  };
}

async function main() {
  const outArg = process.argv.slice(2).find((arg) => arg.startsWith('--out='));
  const workersArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--workers='));
  const outputPath = outArg
    ? path.resolve(rootDir, outArg.split('=')[1])
    : path.resolve(rootDir, '.tmp/cloudflare.secrets.env');
  if (!workersArg) {
    throw new Error(
      'Cloudflare secrets generation requires --workers=state|app|all|<comma-list>'
    );
  }

  const workerKeys = resolveCloudflareWorkerKeys(workersArg.split('=')[1]);
  const result = await writeCloudflareSecretsFile({ outputPath, workerKeys });
  process.stdout.write(`${result.outputPath}\n`);
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
