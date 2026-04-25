import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { assertTopologySignatureConsistency } from '../../scripts/check-cf-topology-signature.mjs';
import { readCurrentSiteConfig } from '../../scripts/lib/site-config.mjs';
import {
  resolveAllSiteDeployContracts,
  resolveSiteDeployContractFromSources,
} from '../../scripts/lib/site-deploy-contract.mjs';
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

test('multi-site deploy contract 拒绝重复 domain route pattern', async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'site-domain-'));

  try {
    for (const siteKey of ['dev-local', 'mamamiya']) {
      const targetDir = path.join(tempDir, 'sites', siteKey);
      await mkdir(targetDir, { recursive: true });
      await cp(
        path.join(process.cwd(), 'sites', siteKey, 'deploy.settings.json'),
        path.join(targetDir, 'deploy.settings.json')
      );
      await cp(
        path.join(process.cwd(), 'sites', siteKey, 'site.config.json'),
        path.join(targetDir, 'site.config.json')
      );
    }

    const mamamiyaConfigPath = path.join(
      tempDir,
      'sites/mamamiya/site.config.json'
    );
    const mamamiyaConfig = JSON.parse(
      await readFile(mamamiyaConfigPath, 'utf8')
    );
    await writeFile(
      mamamiyaConfigPath,
      JSON.stringify(
        {
          ...mamamiyaConfig,
          domain: 'localhost',
          brand: {
            ...mamamiyaConfig.brand,
            appUrl: 'http://localhost:3001',
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    assert.throws(
      () => resolveAllSiteDeployContracts({ rootDir: tempDir }),
      /duplicate site route pattern detected for "localhost" between dev-local and mamamiya/
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
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

  assert.equal(
    disabledContract.topologySignature,
    stripeContract.topologySignature
  );
  assert.notDeepEqual(
    disabledContract.bindingRequirements.payment,
    stripeContract.bindingRequirements.payment
  );
});
