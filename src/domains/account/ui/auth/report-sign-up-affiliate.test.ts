import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicUiConfig } from '@/domains/settings/application/settings-runtime.contracts';

import { reportSignUpAffiliate } from './report-sign-up-affiliate';

const ENABLED_UI_CONFIG: PublicUiConfig = {
  aiEnabled: false,
  localeSwitcherEnabled: false,
  socialLinksEnabled: false,
  socialLinksJson: '',
  socialLinks: [],
  affiliate: {
    affonsoEnabled: true,
    promotekitEnabled: true,
  },
};

test('reportSignUpAffiliate 在开启时上报 Affonso 和 PromoteKit', () => {
  const calls: string[] = [];

  reportSignUpAffiliate({
    uiConfig: ENABLED_UI_CONFIG,
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
    uiConfig: {
      ...ENABLED_UI_CONFIG,
      affiliate: {
        affonsoEnabled: false,
        promotekitEnabled: true,
      },
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
    uiConfig: ENABLED_UI_CONFIG,
    userEmail: 'user@example.com',
  });

  assert.deepEqual(calls, ['user@example.com']);
});
