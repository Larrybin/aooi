import assert from 'node:assert/strict';
import test from 'node:test';

import { assertTopologySignatureConsistency } from '../../scripts/check-cf-topology-signature.mjs';
import { resolveAllSiteDeployContracts } from '../../scripts/lib/site-deploy-contract.mjs';

test('multi-site topology signature 在所有站点上一致', () => {
  const signatures = assertTopologySignatureConsistency({
    rootDir: process.cwd(),
  });

  assert.equal(signatures.length >= 2, true);
});

test('multi-site deploy contract 只允许实例值差异', () => {
  const contracts = resolveAllSiteDeployContracts({
    rootDir: process.cwd(),
  });

  const [first, second] = contracts;
  assert.notEqual(first.workers.router, second.workers.router);
  assert.equal(first.topologySignature, second.topologySignature);
});
