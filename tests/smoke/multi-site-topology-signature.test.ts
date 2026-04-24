import assert from 'node:assert/strict';
import test from 'node:test';

import { assertTopologySignatureConsistency } from '../../scripts/check-cf-topology-signature.mjs';
import {
  resolveAllSiteDeployContracts,
  resolveSiteDeployContractFromSources,
} from '../../scripts/lib/site-deploy-contract.mjs';
import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';
import { readSiteDeploySettings } from '../../scripts/lib/site-deploy-settings.mjs';

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

test('topology signature 只表示结构一致，不表示 payment 行为一致', () => {
  const site = readCurrentSiteConfig({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const deploySettings = readSiteDeploySettings({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  const disabledContract = resolveSiteDeployContractFromSources({
    site: {
      ...site,
      capabilities: {
        ...site.capabilities,
        payment: 'none',
      },
    },
    siteKey: 'fixture-none',
    deploySettings,
  });
  const stripeContract = resolveSiteDeployContractFromSources({
    site: {
      ...site,
      capabilities: {
        ...site.capabilities,
        payment: 'stripe',
      },
    },
    siteKey: 'fixture-stripe',
    deploySettings,
  });

  assert.equal(disabledContract.topologySignature, stripeContract.topologySignature);
  assert.notDeepEqual(
    disabledContract.bindingRequirements.payment,
    stripeContract.bindingRequirements.payment
  );
});
