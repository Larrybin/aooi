import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';

test('deploy contract resolver 在相同输入下输出完全一致', () => {
  const first = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const second = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });

  assert.deepEqual(second, first);
});
