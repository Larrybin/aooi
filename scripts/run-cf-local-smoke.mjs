import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCloudflareAuthSecretValue } from './create-cf-secrets-file.mjs';
import { runCloudflareAppSmoke } from './run-cf-app-smoke.mjs';
import {
  renderCloudflareLocalTopologyLogs,
  startCloudflareLocalDevTopology,
} from './lib/cloudflare-local-topology.mjs';
import { waitForPreviewReady } from './run-cf-preview-smoke.mjs';

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const defaultTemplatePath = path.resolve(rootDir, 'wrangler.cloudflare.toml');
const defaultBaseUrl = 'http://localhost:8787';
const defaultLocalSmokeSecret = 'local-cloudflare-smoke-secret-0123456789';

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
    await waitForPreviewReadyImpl({ baseUrl: resolvedBaseUrl });
    await runCloudflareAppSmokeImpl({ baseUrl: resolvedBaseUrl });
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
