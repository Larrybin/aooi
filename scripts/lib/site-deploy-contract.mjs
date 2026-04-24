import { existsSync, readdirSync } from 'node:fs';

import { readCurrentSiteConfig, resolveRequiredSiteKey } from './site-config.mjs';
import {
  CLOUDFLARE_RESOURCE_SLOT_KEYS,
  CLOUDFLARE_STATE_SLOT_KEYS,
  CLOUDFLARE_WORKER_SLOT_KEYS,
  readSiteDeploySettings,
} from './site-deploy-settings.mjs';

import cloudflareWorkerTopology from '../../src/shared/config/cloudflare-worker-topology.ts';

const {
  CLOUDFLARE_ALL_SERVER_WORKER_TARGETS,
  CLOUDFLARE_DURABLE_OBJECT_BINDINGS,
  CLOUDFLARE_LOCAL_WORKER_URL_VARS,
  CLOUDFLARE_ROUTER_WORKER,
  CLOUDFLARE_SERVICE_BINDINGS,
  CLOUDFLARE_STATE_WORKER,
  CLOUDFLARE_VERSION_ID_VARS,
  getServerWorkerMetadata,
} = cloudflareWorkerTopology;

const CLOUDFLARE_ROUTER_SLOT = 'router';
const CLOUDFLARE_STATE_SLOT = 'state';
const ROUTE_CUSTOM_DOMAIN = true;

function sortObject(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => sortObject(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortObject(entry)])
  );
}

function buildCanonicalBindingShape(contract) {
  return {
    bindingRequirements: {
      secrets: Object.fromEntries(
        Object.keys(contract.bindingRequirements.secrets).map((key) => [
          key,
          'boolean',
        ])
      ),
      vars: Object.fromEntries(
        Object.keys(contract.bindingRequirements.vars).map((key) => [
          key,
          'boolean',
        ])
      ),
    },
    resources: Object.fromEntries(
      CLOUDFLARE_RESOURCE_SLOT_KEYS.map((key) => [key, 'string'])
    ),
    state: Object.fromEntries(
      CLOUDFLARE_STATE_SLOT_KEYS.map((key) => [key, key === 'schemaVersion' ? 'integer' : 'unknown'])
    ),
    workers: Object.fromEntries(
      CLOUDFLARE_WORKER_SLOT_KEYS.map((key) => [key, 'string'])
    ),
  };
}

function buildServerWorkers(deploySettings) {
  return Object.fromEntries(
    CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => {
      const metadata = getServerWorkerMetadata(target);
      return [
        target,
        {
          ...metadata,
          slot: target,
          workerName: deploySettings.workers[target],
          localWorkerUrlVar: CLOUDFLARE_LOCAL_WORKER_URL_VARS[target],
          versionIdVar: CLOUDFLARE_VERSION_ID_VARS[target],
          serviceBinding: CLOUDFLARE_SERVICE_BINDINGS[target],
        },
      ];
    })
  );
}

function buildTopologySignature(contract) {
  return JSON.stringify(
    sortObject({
      bindingShape: buildCanonicalBindingShape(contract),
      resources: Object.keys(contract.resources),
      state: Object.keys(contract.state),
      workers: Object.keys(contract.workers),
      router: {
        bindings: Object.keys(contract.router.serviceBindings),
        durableObjects: Object.keys(contract.router.durableObjects),
        versionVars: Object.keys(contract.router.versionVars),
      },
      stateWorker: {
        durableObjects: Object.keys(contract.stateWorker.durableObjects),
        migrations: Object.keys(contract.stateWorker.migrations),
      },
      serverWorkers: Object.fromEntries(
        Object.entries(contract.serverWorkers).map(([target, worker]) => [
          target,
          {
            bundleEntryRelativePath: worker.bundleEntryRelativePath,
            localWorkerUrlVar: worker.localWorkerUrlVar,
            serviceBinding: worker.serviceBinding,
            versionIdVar: worker.versionIdVar,
            workerEntryRelativePath: worker.workerEntryRelativePath,
            wranglerConfigRelativePath: worker.wranglerConfigRelativePath,
          },
        ])
      ),
    })
  );
}

export function normalizeDeployContractShape(contract) {
  return sortObject(JSON.parse(buildTopologySignature(contract)));
}

export function resolveSiteDeployContractFromSources({
  site,
  siteKey,
  deploySettings,
}) {
  const serverWorkers = buildServerWorkers(deploySettings);
  const stateMigrationTag = `${deploySettings.workers.state}-v${deploySettings.state.schemaVersion}`;
  const appUrl = site.brand.appUrl;
  const appOrigin = new URL(appUrl).origin;

  const contract = {
    site,
    siteKey,
    appUrl,
    appOrigin,
    route: {
      pattern: site.domain,
      customDomain: ROUTE_CUSTOM_DOMAIN,
    },
    bindingRequirements: deploySettings.bindingRequirements,
    workers: deploySettings.workers,
    resources: deploySettings.resources,
    state: deploySettings.state,
    router: {
      slot: CLOUDFLARE_ROUTER_SLOT,
      workerName: deploySettings.workers.router,
      workerEntryRelativePath: CLOUDFLARE_ROUTER_WORKER.workerEntryRelativePath,
      wranglerConfigRelativePath: CLOUDFLARE_ROUTER_WORKER.wranglerConfigRelativePath,
      serviceBindings: {
        WORKER_SELF_REFERENCE: deploySettings.workers.router,
        ...Object.fromEntries(
          CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
            CLOUDFLARE_SERVICE_BINDINGS[target],
            deploySettings.workers[target],
          ])
        ),
      },
      versionVars: Object.fromEntries(
        CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => [
          CLOUDFLARE_VERSION_ID_VARS[target],
          '',
        ])
      ),
      workerNameVars: Object.fromEntries(
        CLOUDFLARE_ALL_SERVER_WORKER_TARGETS.map((target) => {
          const metadata = getServerWorkerMetadata(target);
          return [metadata.workerNameVar, deploySettings.workers[target]];
        })
      ),
      durableObjects: Object.fromEntries(
        Object.entries(CLOUDFLARE_DURABLE_OBJECT_BINDINGS).map(
          ([bindingName, className]) => [
            bindingName,
            {
              className,
              scriptName: deploySettings.workers.state,
            },
          ]
        )
      ),
    },
    stateWorker: {
      slot: CLOUDFLARE_STATE_SLOT,
      workerName: deploySettings.workers.state,
      workerEntryRelativePath: CLOUDFLARE_STATE_WORKER.workerEntryRelativePath,
      wranglerConfigRelativePath: CLOUDFLARE_STATE_WORKER.wranglerConfigRelativePath,
      selfReferenceService: deploySettings.workers.router,
      durableObjects: Object.fromEntries(
        Object.entries(CLOUDFLARE_DURABLE_OBJECT_BINDINGS).map(
          ([bindingName, className]) => [bindingName, { className }]
        )
      ),
      migrations: {
        tag: stateMigrationTag,
        newSqliteClasses: Object.values(CLOUDFLARE_DURABLE_OBJECT_BINDINGS),
      },
    },
    serverWorkers,
  };

  return {
    ...contract,
    topologySignature: buildTopologySignature(contract),
  };
}

export function listSiteKeys({ rootDir = process.cwd() } = {}) {
  return readdirSync(`${rootDir}/sites`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => {
      const siteDir = `${rootDir}/sites/${entry.name}`;
      return (
        existsSync(`${siteDir}/site.config.json`) &&
        existsSync(`${siteDir}/deploy.settings.json`)
      );
    })
    .map((entry) => entry.name)
    .sort();
}

export function resolveSiteDeployContract({
  rootDir = process.cwd(),
  siteKey = resolveRequiredSiteKey(),
} = {}) {
  const site = readCurrentSiteConfig({ rootDir, siteKey });
  const deploySettings = readSiteDeploySettings({ rootDir, siteKey });
  return resolveSiteDeployContractFromSources({ site, siteKey, deploySettings });
}

export function resolveAllSiteDeployContracts({ rootDir = process.cwd() } = {}) {
  const siteKeys = listSiteKeys({ rootDir });
  return siteKeys.map((siteKey) =>
    resolveSiteDeployContract({
      rootDir,
      siteKey,
    })
  );
}

export function createCanonicalTypegenContract(contract) {
  return resolveSiteDeployContractFromSources({
    siteKey: contract.siteKey,
    site: {
      ...contract.site,
      domain: 'typegen.example.com',
      brand: {
        ...contract.site.brand,
        appUrl: 'https://typegen.example.com',
      },
    },
    deploySettings: {
      bindingRequirements: contract.bindingRequirements,
      configVersion: 1,
      workers: {
        router: 'cloudflare-typegen-router',
        state: 'cloudflare-typegen-state',
        'public-web': 'cloudflare-typegen-public-web',
        auth: 'cloudflare-typegen-auth',
        payment: 'cloudflare-typegen-payment',
        member: 'cloudflare-typegen-member',
        chat: 'cloudflare-typegen-chat',
        admin: 'cloudflare-typegen-admin',
      },
      resources: {
        incrementalCacheBucket: 'cloudflare-typegen-opennext-cache',
        appStorageBucket: 'cloudflare-typegen-storage',
        hyperdriveId: '00000000000000000000000000000001',
      },
      state: {
        schemaVersion: 1,
      },
    },
  });
}
