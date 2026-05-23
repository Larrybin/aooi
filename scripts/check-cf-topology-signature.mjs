import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveAllSiteDeployContracts } from './lib/site-deploy-contract.mjs';
import {
  CLOUDFLARE_REQUIRED_WORKER_SLOT_KEYS,
  CLOUDFLARE_SERVER_WORKER_SLOT_KEYS,
} from './lib/site-deploy-settings.mjs';

function fail(message) {
  process.stderr.write(`[cf:topology] ${message}\n`);
  process.exit(1);
}

function sortedKeys(value) {
  return Object.keys(value).sort();
}

function assertSameMembers(actual, expected, label) {
  const actualJson = JSON.stringify([...actual].sort());
  const expectedJson = JSON.stringify([...expected].sort());
  if (actualJson !== expectedJson) {
    throw new Error(
      `${label} mismatch: expected ${expectedJson}, received ${actualJson}`
    );
  }
}

function assertContractTopology(contract) {
  const activeWorkers = sortedKeys(contract.workers);
  const missingRequiredWorkers = CLOUDFLARE_REQUIRED_WORKER_SLOT_KEYS.filter(
    (slot) => !activeWorkers.includes(slot)
  );
  if (missingRequiredWorkers.length > 0) {
    throw new Error(
      `${contract.siteKey} deploy contract is missing required worker slot(s): ${missingRequiredWorkers.join(', ')}`
    );
  }

  const activeServerWorkers = activeWorkers.filter((slot) =>
    CLOUDFLARE_SERVER_WORKER_SLOT_KEYS.includes(slot)
  );
  assertSameMembers(
    Object.keys(contract.serverWorkers),
    activeServerWorkers,
    `${contract.siteKey} serverWorkers`
  );

  for (const slot of CLOUDFLARE_SERVER_WORKER_SLOT_KEYS) {
    const active = activeServerWorkers.includes(slot);
    const serverWorker = contract.serverWorkers[slot];
    if (!active && serverWorker) {
      throw new Error(
        `${contract.siteKey} serverWorkers includes disabled worker slot: ${slot}`
      );
    }
    if (!active) continue;

    if (serverWorker.workerName !== contract.workers[slot]) {
      throw new Error(
        `${contract.siteKey} serverWorkers.${slot}.workerName must equal workers.${slot}`
      );
    }
    if (!(serverWorker.serviceBinding in contract.router.serviceBindings)) {
      throw new Error(
        `${contract.siteKey} router is missing service binding for active worker: ${slot}`
      );
    }
    if (!(serverWorker.versionIdVar in contract.router.versionVars)) {
      throw new Error(
        `${contract.siteKey} router is missing version var for active worker: ${slot}`
      );
    }
  }

  const expectedServiceBindings = [
    'WORKER_SELF_REFERENCE',
    ...activeServerWorkers.map(
      (slot) => contract.serverWorkers[slot].serviceBinding
    ),
  ];
  assertSameMembers(
    Object.keys(contract.router.serviceBindings),
    expectedServiceBindings,
    `${contract.siteKey} router.serviceBindings`
  );
  assertSameMembers(
    Object.keys(contract.router.versionVars),
    activeServerWorkers.map(
      (slot) => contract.serverWorkers[slot].versionIdVar
    ),
    `${contract.siteKey} router.versionVars`
  );
}

export function assertMultiSiteTopologyContract({
  rootDir = process.cwd(),
} = {}) {
  const contracts = resolveAllSiteDeployContracts({ rootDir });
  if (contracts.length === 0) {
    throw new Error('No sites found under sites/*');
  }

  for (const contract of contracts) assertContractTopology(contract);

  return contracts.map((contract) => ({
    activeWorkers: sortedKeys(contract.workers),
    siteKey: contract.siteKey,
    topologySignature: contract.topologySignature,
  }));
}

function main() {
  const signatures = assertMultiSiteTopologyContract();
  process.stdout.write(
    `[cf:topology] verified sites: ${signatures
      .map((entry) => `${entry.siteKey}(${entry.activeWorkers.join(',')})`)
      .join(', ')}\n`
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (error) {
    fail(error instanceof Error ? error.stack || error.message : String(error));
  }
}
