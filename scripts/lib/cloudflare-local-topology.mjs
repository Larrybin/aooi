import net from 'node:net';
import path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { buildCloudflareSecretsEnv } from '../create-cf-secrets-file.mjs';
import { buildCloudflareWranglerConfig } from '../create-cf-wrangler-config.mjs';
import {
  createPreviewManager,
  createWranglerDevManager,
  ensureCiDevVars,
  normalizePreviewBaseUrl,
  resolveAuthSecret,
} from './cloudflare-dev-runtime.mjs';
import cloudflareWorkerSplits from '../../src/shared/config/cloudflare-worker-splits.ts';

const {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  getServerWorkerMetadata,
} = cloudflareWorkerSplits;

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);

const DEFAULT_ROUTER_BASE_URL = 'http://localhost:8787';
const DEFAULT_ROUTER_PORT = 8787;
const DEFAULT_SERVER_PORT_BASE = 8788;
const DEFAULT_INSPECTOR_PORT_BASE = 19229;

function buildLocalTopologyRuntimeVars(routerBaseUrl) {
  return {
    NEXT_PUBLIC_APP_URL: routerBaseUrl,
    AUTH_URL: routerBaseUrl,
    BETTER_AUTH_URL: routerBaseUrl,
    CF_LOCAL_SMOKE_WORKERS_DEV: 'true',
  };
}

function buildLocalWorkerRuntimeVars(serverWorkers, routerBaseUrl) {
  const { protocol, hostname } = new URL(routerBaseUrl);

  return Object.fromEntries(
    serverWorkers.map((worker) => [
      CLOUDFLARE_LOCAL_WORKER_URL_VARS[worker.target],
      `${protocol}//${hostname}:${worker.port}`,
    ])
  );
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
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    // Wrangler/workerd bind loopback ports, so probe the same host to avoid
    // false positives from IPv6-only wildcard checks on macOS.
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
  const reservedPorts = new Set();
  const requestedUrl = new URL(normalizePreviewBaseUrl(routerBaseUrl));
  const requestedRouterPort =
    Number.parseInt(requestedUrl.port || String(DEFAULT_ROUTER_PORT), 10) ||
    DEFAULT_ROUTER_PORT;
  const requestedServerPortBase =
    requestedRouterPort === DEFAULT_ROUTER_PORT
      ? DEFAULT_SERVER_PORT_BASE
      : requestedRouterPort + 1;

  const routerPort = await findAvailablePort(requestedRouterPort, reservedPorts);
  reservedPorts.add(routerPort);

  const serverPorts = {};
  const inspectorPorts = {};
  let nextPort = requestedServerPortBase;
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const port = await findAvailablePort(nextPort, reservedPorts);
    serverPorts[target] = port;
    reservedPorts.add(port);
    nextPort = port + 1;
  }

  let nextInspectorPort = DEFAULT_INSPECTOR_PORT_BASE;
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const inspectorPort = await findAvailablePort(
      nextInspectorPort,
      reservedPorts
    );
    inspectorPorts[target] = inspectorPort;
    reservedPorts.add(inspectorPort);
    nextInspectorPort = inspectorPort + 1;
  }

  const routerUrl = new URL(requestedUrl.toString());
  routerUrl.port = String(routerPort);

  return {
    routerPort,
    routerBaseUrl: normalizePreviewBaseUrl(routerUrl.toString()),
    serverPorts,
    inspectorPorts,
  };
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
  const stateRootDir = path.join(tempDir, 'state');
  const resolvedDevVarsPath = devVarsPath || path.join(tempDir, '.dev.vars');
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
  });
  await writeFile(routerConfigPath, routerConfig, 'utf8');

  const serverWorkers = [];
  for (const target of CLOUDFLARE_ALL_SERVER_WORKER_TARGETS) {
    const metadata = getServerWorkerMetadata(target);
    const templatePath = path.resolve(rootDir, metadata.wranglerConfigRelativePath);
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
    });
    await writeFile(configPath, config, 'utf8');
    const persistDir = path.join(stateRootDir, target);
    await mkdir(persistDir, { recursive: true });

    serverWorkers.push({
      target,
      label: `Cloudflare server worker ${target}`,
      configPath,
      persistDir,
      port: ports.serverPorts[target],
      inspectorPort: ports.inspectorPorts[target],
      workerName: metadata.workerName,
    });
  }

  const secretsContent = buildCloudflareSecretsEnv(
    {
      ...processEnv,
      AUTH_SECRET: authSecret,
      BETTER_AUTH_SECRET: authSecret,
    },
    { fallbackAuthSecret: authSecret }
  );
  const secretsPath = path.join(tempDir, 'cloudflare.local.secrets.env');
  await writeFile(secretsPath, secretsContent, 'utf8');

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
    router: {
      label: 'Cloudflare preview',
      configPath: routerConfigPath,
      port: ports.routerPort,
      baseUrl: ports.routerBaseUrl,
    },
    serverWorkers,
    secretsPath,
    secretsContent,
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
  return new Error(`${label} failed to start: ${detail}\n${formatRecentLogs(label, manager?.recentLogs)}`);
}

async function stopManagers(managers) {
  for (const manager of managers) {
    try {
      await manager?.stop?.();
    } catch {
      // ignore cleanup failures while unwinding startup
    }
  }
}

export function renderCloudflareLocalTopologyLogs(topology) {
  if (!topology) {
    return '';
  }

  const sections = [];
  if (topology.routerManager) {
    sections.push(
      formatRecentLogs(topology.routerManager.label, topology.routerManager.recentLogs)
    );
  }
  for (const worker of topology.serverWorkers || []) {
    if (worker.manager) {
      sections.push(formatRecentLogs(worker.manager.label, worker.manager.recentLogs));
    }
  }

  return sections.join('\n');
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
    prepareCloudflareLocalTopologyArtifactsImpl =
      prepareCloudflareLocalTopologyArtifacts,
    createPreviewManagerImpl = createPreviewManager,
    createWranglerDevManagerImpl = createWranglerDevManager,
  } = {}
) {
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
    ...buildLocalWorkerRuntimeVars(
      artifacts.serverWorkers,
      artifacts.router.baseUrl
    ),
    AUTH_SECRET: resolvedAuthSecret,
    BETTER_AUTH_SECRET: resolvedAuthSecret,
    DEPLOY_TARGET: 'cloudflare',
    ...resolveLocalTopologyExtraVars(extraVars, processEnv),
  };

  let routerManager = null;
  const startedServerWorkers = [];

  try {
    for (const worker of artifacts.serverWorkers) {
      const manager = createWranglerDevManagerImpl({
        label: worker.label,
        wranglerConfigPath: worker.configPath,
        port: worker.port,
        inspectorPort: worker.inspectorPort,
        name: worker.workerName,
        persistTo: worker.persistDir,
        env: childEnv,
        logger,
      });
      worker.manager = manager;
      startedServerWorkers.push(worker);
    }

    for (const worker of startedServerWorkers) {
      try {
        await worker.manager.readyUrlPromise;
      } catch (error) {
        throw buildManagerStartError(worker.label, worker.manager, error);
      }
    }

    routerManager = createPreviewManagerImpl({
      wranglerConfigPath: artifacts.router.configPath,
      env: childEnv,
      logger,
    });
    const routerBaseUrlResolved = normalizePreviewBaseUrl(
      await routerManager.readyUrlPromise
    );

    return {
      routerManager,
      router: {
        ...artifacts.router,
        baseUrl: routerBaseUrlResolved,
      },
      serverWorkers: startedServerWorkers,
      getRouterBaseUrl() {
        return routerBaseUrlResolved;
      },
      getRecentLogs() {
        return renderCloudflareLocalTopologyLogs(this);
      },
      async stop() {
        await stopManagers([
          routerManager,
          ...startedServerWorkers.map((worker) => worker.manager).reverse(),
        ]);
        await artifacts.cleanup();
      },
    };
  } catch (error) {
    await stopManagers([
      routerManager,
      ...startedServerWorkers.map((worker) => worker.manager).reverse(),
    ]);
    await artifacts.cleanup();
    throw error;
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
