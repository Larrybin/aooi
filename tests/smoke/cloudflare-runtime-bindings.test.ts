import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CLOUDFLARE_SECRET_WORKER_ALLOWLIST,
  getRequiredRuntimeBindingsByWorker,
} from '../../scripts/lib/cloudflare-runtime-bindings.mjs';
import { resolveSiteDeployContract } from '../../scripts/lib/site-deploy-contract.mjs';

test('cloudflare runtime bindings: RESEND_API_KEY allowlist 固定为 auth/admin', () => {
  assert.deepEqual(CLOUDFLARE_SECRET_WORKER_ALLOWLIST.RESEND_API_KEY, [
    'auth',
    'admin',
  ]);
});

test('cloudflare runtime bindings: emailProvider 只分配到 auth/admin worker', () => {
  const contract = resolveSiteDeployContract({
    rootDir: process.cwd(),
    siteKey: 'mamamiya',
  });
  const requirements = getRequiredRuntimeBindingsByWorker(
    contract.bindingRequirements
  );

  const authSecrets = requirements
    .get('auth')
    ?.filter((item) => item.name === 'RESEND_API_KEY')
    .map((item) => item.worker);
  const adminSecrets = requirements
    .get('admin')
    ?.filter((item) => item.name === 'RESEND_API_KEY')
    .map((item) => item.worker);
  const paymentSecrets = requirements
    .get('payment')
    ?.filter((item) => item.name === 'RESEND_API_KEY');

  assert.deepEqual(authSecrets, ['auth']);
  assert.deepEqual(adminSecrets, ['admin']);
  assert.deepEqual(paymentSecrets, []);
});
