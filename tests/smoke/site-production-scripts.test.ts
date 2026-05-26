import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProductionDeploySettingsJson,
  buildProductionHyperdriveName,
  isProductionHyperdrivePlaceholder,
  updateProductionDeploySettingsHyperdriveId,
} from '../../scripts/site-production.mjs';

const baseSiteConfig = {
  capabilities: {
    ai: false,
    auth: true,
    blog: false,
    docs: false,
    payment: 'creem',
  },
  domain: 'example.com',
  key: 'background-remover',
};

const baseDeploySettings = {
  bindingRequirements: {
    bindings: {
      workersAi: false,
    },
    secrets: {
      authSharedSecret: true,
      githubOauth: false,
      googleOauth: true,
      removerCleanup: true,
    },
    vars: {
      storagePublicBaseUrl: true,
    },
  },
  configVersion: 1,
  resources: {
    appStorageBucket: 'aooi-background-remover-storage',
    hyperdriveId: '00000000000000000000000000000003',
    incrementalCacheBucket: 'aooi-background-remover-opennext-cache',
  },
  state: {
    schemaVersion: 1,
  },
  workers: {
    admin: 'aooi-background-remover-admin',
    auth: 'aooi-background-remover-auth',
    member: 'aooi-background-remover-member',
    payment: 'aooi-background-remover-payment',
    'public-web': 'aooi-background-remover-public-web',
    router: 'aooi-background-remover-router',
    state: 'aooi-background-remover-state',
  },
};

test('site production provision identifies only known placeholder Hyperdrive ids', () => {
  assert.equal(
    isProductionHyperdrivePlaceholder('00000000000000000000000000000000'),
    true
  );
  assert.equal(
    isProductionHyperdrivePlaceholder('00000000000000000000000000000003'),
    true
  );
  assert.equal(
    isProductionHyperdrivePlaceholder('0123456789abcdef0123456789abcdef'),
    false
  );
});

test('site production provision derives the production Hyperdrive name', () => {
  assert.equal(
    buildProductionHyperdriveName('background-remover'),
    'aooi-background-remover-db'
  );
});

test('site production provision updates only the Hyperdrive id', () => {
  const updated = updateProductionDeploySettingsHyperdriveId(
    baseDeploySettings,
    '0123456789abcdef0123456789abcdef'
  );

  assert.equal(
    updated.resources.hyperdriveId,
    '0123456789abcdef0123456789abcdef'
  );
  assert.equal(
    updated.resources.appStorageBucket,
    baseDeploySettings.resources.appStorageBucket
  );
  assert.equal(updated.workers.router, baseDeploySettings.workers.router);
});

test('site production provision writes deploy settings JSON with a real Hyperdrive id', () => {
  assert.equal(
    buildProductionDeploySettingsJson({
      deploySettings: baseDeploySettings,
      hyperdriveId: '0123456789abcdef0123456789abcdef',
      siteConfig: baseSiteConfig,
    }),
    `${JSON.stringify(
      {
        ...baseDeploySettings,
        resources: {
          ...baseDeploySettings.resources,
          hyperdriveId: '0123456789abcdef0123456789abcdef',
        },
      },
      null,
      2
    )}\n`
  );
  assert.throws(
    () =>
      updateProductionDeploySettingsHyperdriveId(
        baseDeploySettings,
        'replace_with_hyperdrive_id'
      ),
    /production Hyperdrive id/
  );
});
