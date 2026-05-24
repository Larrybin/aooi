import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { defineProductRuntimeContract } from '../domain/contract';
import {
  assertProductRuntimeContract,
  checkProductRuntimeContract,
  ProductRuntimeContractError,
} from './assert-runtime-contract';

const aiRemoverRuntimeContract = defineProductRuntimeContract({
  siteKey: 'ai-remover',
  productKey: 'ai-remover',
  requiredWorkers: {
    'public-web': true,
  },
  requiredBindings: {
    workersAi: true,
  },
  requiredVars: {
    storagePublicBaseUrl: true,
  },
  requiredSecrets: {
    removerCleanup: true,
  },
});

const validTarget = {
  siteKey: 'ai-remover',
  workers: {
    router: 'aooi-ai-remover-router',
    state: 'aooi-ai-remover-state',
    'public-web': 'aooi-ai-remover-public-web',
  },
  bindingRequirements: {
    bindings: {
      workersAi: true,
    },
    vars: {
      storagePublicBaseUrl: true,
    },
    secrets: {
      removerCleanup: true,
    },
  },
};

test('assertProductRuntimeContract accepts matching product runtime requirements', () => {
  const result = assertProductRuntimeContract({
    contract: aiRemoverRuntimeContract,
    target: validTarget,
  });

  assert.deepEqual(result.required, {
    workers: ['public-web'],
    bindings: ['workersAi'],
    vars: ['storagePublicBaseUrl'],
    secrets: ['removerCleanup'],
  });
});

test('checkProductRuntimeContract reports missing bindings, vars, secrets, and workers', () => {
  const result = checkProductRuntimeContract({
    contract: aiRemoverRuntimeContract,
    target: {
      siteKey: 'ai-remover',
      workers: {
        router: 'aooi-ai-remover-router',
      },
      bindingRequirements: {
        bindings: {
          workersAi: false,
        },
        vars: {},
        secrets: {},
      },
    },
  });

  assert.deepEqual(result.issues, [
    { code: 'missing_worker', key: 'public-web' },
    { code: 'missing_binding', key: 'workersAi' },
    { code: 'missing_var', key: 'storagePublicBaseUrl' },
    { code: 'missing_secret', key: 'removerCleanup' },
  ]);
});

test('assertProductRuntimeContract throws a typed error for missing runtime contract requirements', () => {
  assert.throws(
    () =>
      assertProductRuntimeContract({
        contract: aiRemoverRuntimeContract,
        target: {
          ...validTarget,
          bindingRequirements: {
            ...validTarget.bindingRequirements,
            secrets: {
              removerCleanup: false,
            },
          },
        },
      }),
    (error) =>
      error instanceof ProductRuntimeContractError &&
      error.issues.length === 1 &&
      error.issues[0]?.code === 'missing_secret' &&
      error.issues[0]?.key === 'removerCleanup'
  );
});

test('product-runtime source files do not import remover', () => {
  const root = path.join(process.cwd(), 'src/domains/product-runtime');
  const files = ['domain', 'application'].flatMap((segment) =>
    readdirSync(path.join(root, segment))
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => path.join(root, segment, file))
  );

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /domains\/remover|@\/domains\/remover/);
  }
});
