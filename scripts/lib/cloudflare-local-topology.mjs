import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits.ts';
import { buildCloudflareWranglerConfig } from '../create-cf-wrangler-config.mjs';
import {
  createWranglerMultiConfigDevManager,
  ensureCiDevVars,
  normalizePreviewBaseUrl,
  resolveAuthSecret,
} from './cloudflare-dev-runtime.mjs';

const { CLOUDFLARE_ALL_SERVER_WORKER_TARGETS, getServerWorkerMetadata } =
  cloudflareWorkerSplits;

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const DEFAULT_ROUTER_BASE_URL = 'http://localhost:8787';
const DEFAULT_ROUTER_PORT = 8787;
const TOPOLOGY_MANAGER_LABEL = 'Cloudflare local topology';
const ROUTER_RUNTIME_ARTIFACTS = [
  '.open-next/worker.js',
  '.open-next/cloudflare/images.js',
  '.open-next/cloudflare/init.js',
  '.open-next/middleware/handler.mjs',
  '.open-next/.build/durable-objects/queue.js',
  '.open-next/.build/durable-objects/sharded-tag-cache.js',
];

function buildLocalTopologyRuntimeVars(routerBaseUrl) {
  return {
    NEXT_PUBLIC_APP_URL: routerBaseUrl,
    AUTH_URL: routerBaseUrl,
    BETTER_AUTH_URL: routerBaseUrl,
    CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
  };
}

function resolveLocalTopologyExtraVars(extraVars, processEnv) {
  const resolvedExtraVars = { ...extraVars };
  const localAuthDebug = processEnv.CF_LOCAL_AUTH_DEBUG?.trim();

  if (localAuthDebug) {
    resolvedExtraVars.CF_LOCAL_AUTH_DEBUG = localAuthDebug;
  }

  return resolvedExtraVars;
}

function readWranglerLocalConnectionString(content) {
  const match = content.match(
    /\[\[hyperdrive\]\][\s\S]*?^\s*localConnectionString\s*=\s*"([^"\n]+)"/m
  );
  return match?.[1]?.trim() || '';
}

async function canListenOnPort(port) {
  return await new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findAvailablePort(startPort, reservedPorts = new Set()) {
  for (let port = startPort; port < startPort + 200; port += 1) {
    if (reservedPorts.has(port)) {
      continue;
    }

    if (await canListenOnPort(port)) {
      return port;
    }
  }

  throw new Error(`No available port found from ${startPort}`);
}

export async function resolveCloudflareLocalTopologyPorts({
  routerBaseUrl = DEFAULT_ROUTER_BASE_URL,
} = {}) {
  const requestedUrl = new URL(normalizePreviewBaseUrl(routerBaseUrl));
  const requestedRouterPort =
    Number.parseInt(requestedUrl.port || String(DEFAULT_ROUTER_PORT), 10) ||
    DEFAULT_ROUTER_PORT;
  const routerPort = await findAvailablePort(requestedRouterPort);

  requestedUrl.port = String(routerPort);

  return {
    routerPort,
    routerBaseUrl: normalizePreviewBaseUrl(requestedUrl.toString()),
  };
}

function resolveServerWorkerHandlerPath(target) {
  const metadata = getServerWorkerMetadata(target);
  return path.join(
    path.dirname(metadata.bundleEntryRelativePath),
    'handler.mjs'
  );
}

function getRequiredLocalBuildArtifactPaths() {
  return [
    ...ROUTER_RUNTIME_ARTIFACTS,
    ...CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) =>
      resolveServerWorkerHandlerPath(target)
    ),
  ];
}

export async function assertCloudflareLocalBuildArtifactsReady({
  rootPath = rootDir,
} = {}) {
  const missingPaths = [];

  for (const relativePath of getRequiredLocalBuildArtifactPaths()) {
    try {
      await stat(path.resolve(rootPath, relativePath));
    } catch {
      missingPaths.push(relativePath);
    }
  }

  if (missingPaths.length === 0) {
    return;
  }

  throw new Error(
    [
      'Cloudflare local topology requires built OpenNext artifacts.',
      'Run `pnpm cf:build` before starting Cloudflare local smoke or spikes.',
      `Missing artifacts: ${missingPaths.join(', ')}`,
    ].join(' ')
  );
}

export async function prepareCloudflareLocalTopologyArtifacts({
  databaseUrl,
  routerTemplatePath = path.resolve(rootDir, 'wrangler.cloudflare.toml'),
  routerBaseUrl = DEFAULT_ROUTER_BASE_URL,
  authSecret = resolveAuthSecret(),
  extraVars = {},
  processEnv = process.env,
  devVarsPath = null,
} = {}) {
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL or AUTH_SPIKE_DATABASE_URL is required for Cloudflare local topology'
    );
  }

  const runtimeExtraVars = resolveLocalTopologyExtraVars(extraVars, processEnv);
  const tmpRoot = path.resolve(rootDir, '.tmp');
  await mkdir(tmpRoot, { recursive: true });

  const tempDir = await mkdtemp(path.join(tmpRoot, 'cf-local-topology-'));
  const resolvedDevVarsPath = devVarsPath || path.join(tempDir, '.dev.vars');
  const persistDir = path.join(tempDir, 'state');
  const ports = await resolveCloudflareLocalTopologyPorts({ routerBaseUrl });
  const routerDevOrigin = new URL(ports.routerBaseUrl);
  const routerTemplate = await readFile(routerTemplatePath, 'utf8');
  const routerConfigPath = path.join(tempDir, 'wrangler.cloudflare.local.toml');
  const routerConfig = buildCloudflareWranglerConfig({
    template: routerTemplate,
    databaseUrl,
    appUrl: ports.routerBaseUrl,
    deployTarget: 'cloudflare',
    devHost: routerDevOrigin.hostname,
    devUpstreamProtocol: routerDevOrigin.protocol.replace(/:$/, ''),
    templatePath: routerTemplatePath,
    outputPath: routerConfigPath,
    validateTemplateContract: true,
  });
  await writeFile(routerConfigPath, routerConfig, 'utf8');
  await mkdir(persistDir, { recursive: true });

  const serverWorkers = [];
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const metadata = getServerWorkerMetadata(target);
    const templatePath = path.resolve(
      rootDir,
      metadata.wranglerConfigRelativePath
    );
    const template = await readFile(templatePath, 'utf8');
    const configPath = path.join(tempDir, `wrangler.${target}.local.toml`);
    const config = buildCloudflareWranglerConfig({
      template,
      databaseUrl,
      appUrl: ports.routerBaseUrl,
      deployTarget: 'cloudflare',
      devHost: routerDevOrigin.hostname,
      devUpstreamProtocol: routerDevOrigin.protocol.replace(/:$/, ''),
      templatePath,
      outputPath: configPath,
      validateTemplateContract: true,
    });
    await writeFile(configPath, config, 'utf8');

    serverWorkers.push({
      target,
      label: `Cloudflare server worker ${target}`,
      configPath,
      workerName: metadata.workerName,
    });
  }

  const devVars = await ensureCiDevVars({
    authSecret,
    devVarsPath: resolvedDevVarsPath,
    extraVars: {
      DEPLOY_TARGET: 'cloudflare',
      ...buildLocalTopologyRuntimeVars(ports.routerBaseUrl),
      ...runtimeExtraVars,
    },
  });

  return {
    tempDir,
    persistDir,
    router: {
      label: TOPOLOGY_MANAGER_LABEL,
      configPath: routerConfigPath,
      port: ports.routerPort,
      baseUrl: ports.routerBaseUrl,
    },
    serverWorkers,
    wranglerConfigPaths: [
      routerConfigPath,
      ...serverWorkers.map((worker) => worker.configPath),
    ],
    devVars,
    async cleanup() {
      await devVars.cleanup();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

function formatRecentLogs(label, recentLogs) {
  if (!recentLogs?.length) {
    return `--- recent ${label} logs ---\n(no logs)\n--- end ${label} logs ---`;
  }

  return [
    `--- recent ${label} logs ---`,
    recentLogs.join(''),
    `--- end ${label} logs ---`,
  ].join('\n');
}

function buildManagerStartError(label, manager, error) {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(
    `${label} failed to start: ${detail}\n${formatRecentLogs(label, manager?.recentLogs)}`
  );
}

export function renderCloudflareLocalTopologyLogs(topology) {
  if (!topology?.manager) {
    return '';
  }

  return formatRecentLogs(topology.manager.label, topology.manager.recentLogs);
}

export async function startCloudflareLocalDevTopology(
  {
    databaseUrl,
    routerTemplatePath = path.resolve(rootDir, 'wrangler.cloudflare.toml'),
    routerBaseUrl = DEFAULT_ROUTER_BASE_URL,
    authSecret,
    extraVars = {},
    processEnv = process.env,
    logger = console,
    devVarsPath = null,
  } = {},
  {
    assertCloudflareLocalBuildArtifactsReadyImpl = assertCloudflareLocalBuildArtifactsReady,
    prepareCloudflareLocalTopologyArtifactsImpl = prepareCloudflareLocalTopologyArtifacts,
    createWranglerMultiConfigDevManagerImpl = createWranglerMultiConfigDevManager,
  } = {}
) {
  await assertCloudflareLocalBuildArtifactsReadyImpl();

  const resolvedAuthSecret = authSecret || resolveAuthSecret(processEnv);
  const artifacts = await prepareCloudflareLocalTopologyArtifactsImpl({
    databaseUrl,
    routerTemplatePath,
    routerBaseUrl,
    authSecret: resolvedAuthSecret,
    extraVars,
    processEnv,
    devVarsPath,
  });
  const childEnv = {
    ...processEnv,
    ...buildLocalTopologyRuntimeVars(artifacts.router.baseUrl),
    AUTH_SECRET: resolvedAuthSecret,
    BETTER_AUTH_SECRET: resolvedAuthSecret,
    DEPLOY_TARGET: 'cloudflare',
    ...resolveLocalTopologyExtraVars(extraVars, processEnv),
  };

  let manager = null;

  try {
    manager = createWranglerMultiConfigDevManagerImpl({
      label: TOPOLOGY_MANAGER_LABEL,
      wranglerConfigPaths: artifacts.wranglerConfigPaths,
      port: artifacts.router.port,
      persistTo: artifacts.persistDir,
      env: childEnv,
      logger,
    });

    const routerBaseUrlResolved = normalizePreviewBaseUrl(
      await manager.readyUrlPromise
    );

    return {
      manager,
      router: {
        ...artifacts.router,
        baseUrl: routerBaseUrlResolved,
      },
      getRouterBaseUrl() {
        return routerBaseUrlResolved;
      },
      getRecentLogs() {
        return renderCloudflareLocalTopologyLogs(this);
      },
      async stop() {
        await manager?.stop?.();
        await artifacts.cleanup();
      },
    };
  } catch (error) {
    try {
      await manager?.stop?.();
    } catch {
      // ignore cleanup failures while unwinding startup
    }
    await artifacts.cleanup();
    throw buildManagerStartError(TOPOLOGY_MANAGER_LABEL, manager, error);
  }
}

export async function resolveCloudflareLocalDatabaseUrl({
  processEnv = process.env,
  wranglerConfigPath = path.resolve(rootDir, 'wrangler.cloudflare.toml'),
} = {}) {
  const explicitDatabaseUrl =
    processEnv.AUTH_SPIKE_DATABASE_URL?.trim() ||
    processEnv.DATABASE_URL?.trim();
  if (explicitDatabaseUrl) {
    return explicitDatabaseUrl;
  }

  try {
    const wranglerContent = await readFile(wranglerConfigPath, 'utf8');
    return readWranglerLocalConnectionString(wranglerContent);
  } catch {
    return '';
  }
}
