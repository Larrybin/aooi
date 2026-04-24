import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  normalizeDeployContractShape,
  resolveAllSiteDeployContracts,
} from './lib/site-deploy-contract.mjs';

function fail(message) {
  process.stderr.write(`[cf:topology] ${message}\n`);
  process.exit(1);
}

export function assertTopologySignatureConsistency({
  rootDir = process.cwd(),
} = {}) {
  const contracts = resolveAllSiteDeployContracts({ rootDir });
  if (contracts.length === 0) {
    throw new Error('No sites found under sites/*');
  }

  const [firstContract, ...restContracts] = contracts;
  const referenceSignature = firstContract.topologySignature;
  const referenceShape = normalizeDeployContractShape(firstContract);

  for (const contract of restContracts) {
    if (contract.topologySignature !== referenceSignature) {
      throw new Error(
        [
          `multi-site topology signature drift detected between ${firstContract.siteKey} and ${contract.siteKey}`,
          `reference shape: ${JSON.stringify(referenceShape)}`,
          `candidate shape: ${JSON.stringify(normalizeDeployContractShape(contract))}`,
        ].join('\n')
      );
    }
  }

  return contracts.map((contract) => ({
    siteKey: contract.siteKey,
    topologySignature: contract.topologySignature,
  }));
}

function main() {
  const signatures = assertTopologySignatureConsistency();
  process.stdout.write(
    `[cf:topology] verified sites: ${signatures
      .map((entry) => entry.siteKey)
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
