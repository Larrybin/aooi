import '@/config/load-dotenv';

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCloudflareAuthSecretValue } from './create-cf-secrets-file.mjs';
import {
  renderCloudflareLocalTopologyLogs,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { waitForPreviewReady } from './lib/cloudflare-preview-smoke.mjs';
import { runPhaseSequence } from './lib/harness/scenario.mjs';
import { runCloudflareAppSmoke } from './run-cf-app-smoke.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const defaultTemplatePath = path.resolve(rootDir, 'wrangler.cloudflare.toml');
const defaultDevVarsPath = path.resolve(rootDir, '.dev.vars');
const defaultBaseUrl = 'http://localhost:8787';
const defaultLocalSmokeSecret = 'local-cloudflare-smoke-secret-0123456789';

function normalizeEnvValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function parseEnvFileContent(content) {
  const entries = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex <= 0) {
      continue;
    }

    const name = trimmed.slice(0, equalsIndex).trim();
    if (!name) {
      continue;
    }

    entries[name] = normalizeEnvValue(trimmed.slice(equalsIndex + 1));
  }

  return entries;
}

export function injectCloudflareLocalSmokeDevVars(
  processEnv = process.env,
  {
    devVarsPath = processEnv.CF_LOCAL_SMOKE_DEV_VARS_PATH?.trim() ||
      defaultDevVarsPath,
    readFileSyncImpl = readFileSync,
  } = {}
) {
  if (!devVarsPath) {
    return processEnv;
  }

  let content = '';
  try {
    content = readFileSyncImpl(devVarsPath, 'utf8');
  } catch {
    return processEnv;
  }

  const envEntries = parseEnvFileContent(content);
  for (const [name, value] of Object.entries(envEntries)) {
    if (processEnv[name]?.trim()) {
      continue;
    }

    processEnv[name] = value;
  }

  return processEnv;
}

injectCloudflareLocalSmokeDevVars();

export function resolveLocalSmokeDatabaseUrl(processEnv = process.env) {
  return (
    processEnv.AUTH_SPIKE_DATABASE_URL?.trim() ||
    processEnv.DATABASE_URL?.trim() ||
    ''
  );
}

export async function runCloudflareLocalSmoke(
  {
    templatePath = defaultTemplatePath,
    databaseUrl = resolveLocalSmokeDatabaseUrl(),
    baseUrl = defaultBaseUrl,
  } = {},
  {
    startCloudflareLocalDevTopologyImpl = startCloudflareLocalDevTopology,
    waitForPreviewReadyImpl = waitForPreviewReady,
    runCloudflareAppSmokeImpl = runCloudflareAppSmoke,
  } = {}
) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for Cloudflare local smoke'
    );
  }

  const authSecret = resolveCloudflareAuthSecretValue(process.env, {
    fallbackAuthSecret: defaultLocalSmokeSecret,
  });
  const topology = await startCloudflareLocalDevTopologyImpl({
    databaseUrl,
    routerTemplatePath: templatePath,
    routerBaseUrl: baseUrl,
    authSecret,
  });
  const resolvedBaseUrl = topology.getRouterBaseUrl();

  try {
    await runPhaseSequence({
      phases: [
        {
          label: 'preview-ready',
          action: async () => {
            await waitForPreviewReadyImpl({ baseUrl: resolvedBaseUrl });
          },
        },
        {
          label: 'app-smoke',
          action: async () => {
            await runCloudflareAppSmokeImpl({ baseUrl: resolvedBaseUrl });
          },
        },
      ],
    });
  } catch (error) {
    const recentLogs = renderCloudflareLocalTopologyLogs(topology);
    if (recentLogs) {
      console.error(recentLogs);
    }
    throw error;
  } finally {
    await topology.stop();
  }
}

async function main() {
  const templatePath =
    process.env.CF_LOCAL_SMOKE_WRANGLER_TEMPLATE?.trim() || defaultTemplatePath;
  const baseUrl = process.env.CF_LOCAL_SMOKE_URL?.trim() || defaultBaseUrl;

  await runCloudflareLocalSmoke({
    templatePath,
    baseUrl,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.stack || error.message : String(error)
    );
    process.exit(1);
  });
}
