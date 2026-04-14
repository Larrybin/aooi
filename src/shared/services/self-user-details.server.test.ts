import assert from 'node:assert/strict';
import test from 'node:test';

import { readSelfUserDetails } from './self-user-details.server';

test('readSelfUserDetails 聚合当前用户白名单详情', async () => {
  const details = await readSelfUserDetails('user_123', {
    hasPermission: async (userId, permission) => {
      assert.equal(userId, 'user_123');
      assert.equal(permission, 'admin.access');
      return true;
    },
    getRemainingCreditsSummary: async (userId) => {
      assert.equal(userId, 'user_123');
      return { remainingCredits: 7, expiresAt: '2026-04-30T00:00:00.000Z' };
    },
    getCurrentSubscription: async (userId) => {
      assert.equal(userId, 'user_123');
      return { productId: 'pro_monthly' } as never;
    },
  });

  assert.deepEqual(details, {
    isAdmin: true,
    credits: {
      remainingCredits: 7,
      expiresAt: '2026-04-30T00:00:00.000Z',
    },
    currentSubscriptionProductId: 'pro_monthly',
  });
});

test('readSelfUserDetails 在缺少积分或订阅时返回 null 字段而不是扩展用户对象', async () => {
  const details = await readSelfUserDetails('user_456', {
    hasPermission: async () => false,
    getRemainingCreditsSummary: async () => null,
    getCurrentSubscription: async () => null,
  });

  assert.deepEqual(details, {
    isAdmin: false,
    credits: null,
    currentSubscriptionProductId: null,
  });
});
