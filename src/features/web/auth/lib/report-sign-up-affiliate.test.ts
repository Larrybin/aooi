import assert from 'node:assert/strict';
import test from 'node:test';

import { reportSignUpAffiliate } from './report-sign-up-affiliate';

test('reportSignUpAffiliate 在开启时上报 Affonso 和 PromoteKit', () => {
  const calls: string[] = [];

  reportSignUpAffiliate({
    configs: {
      affonso_enabled: 'true',
      promotekit_enabled: 'true',
    },
    userEmail: 'user@example.com',
    stripeCustomerId: 'cus_123',
    win: {
      Affonso: {
        signup(email) {
          calls.push(`affonso:${email}`);
        },
      },
      promotekit: {
        refer(email, customerId) {
          calls.push(`promotekit:${email}:${customerId ?? 'none'}`);
        },
      },
    },
  });

  assert.deepEqual(calls, [
    'affonso:user@example.com',
    'promotekit:user@example.com:cus_123',
  ]);
});

test('reportSignUpAffiliate 在 provider 缺失或关闭时静默跳过', () => {
  const calls: string[] = [];

  reportSignUpAffiliate({
    configs: {
      affonso_enabled: 'false',
      promotekit_enabled: 'true',
    },
    userEmail: 'user@example.com',
    win: {
      promotekit: {
        refer(email) {
          calls.push(email);
        },
      },
    },
  });

  reportSignUpAffiliate({
    configs: {
      affonso_enabled: 'true',
      promotekit_enabled: 'true',
    },
    userEmail: 'user@example.com',
  });

  assert.deepEqual(calls, ['user@example.com']);
});
