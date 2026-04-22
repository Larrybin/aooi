import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACCOUNT_CREDIT_TRANSACTION_TYPE,
  ACCOUNT_CREDIT_ACTIVE_STATUS,
  createOwnApikeyUseCase,
  deleteOwnApikeyUseCase,
  listOwnCreditsUseCase,
  listOwnApikeysUseCase,
  readAccountCreditsSummaryUseCase,
  readAccountRemainingCreditsUseCase,
  readSelfUserDetailsUseCase,
  renameOwnApikeyUseCase,
  requireOwnedApikeyUseCase,
  updateProfileUseCase,
} from './use-cases';

test('readSelfUserDetailsUseCase 聚合成员详情', async () => {
  const details = await readSelfUserDetailsUseCase('user_1', {
    hasPermission: async () => true,
    getRemainingCreditsSummary: async () => ({
      remainingCredits: 7,
      expiresAt: '2026-04-30T00:00:00.000Z',
    }),
    getCurrentSubscription: async () => ({ productId: 'pro_monthly' }),
    getRemainingCredits: async () => 7,
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

test('readAccountCreditsSummaryUseCase 透传 credits summary', async () => {
  const result = await readAccountCreditsSummaryUseCase('user_1', {
    getRemainingCreditsSummary: async () => ({
      remainingCredits: 9,
      expiresAt: null,
    }),
  });

  assert.deepEqual(result, { remainingCredits: 9, expiresAt: null });
});

test('readAccountRemainingCreditsUseCase 返回剩余额度', async () => {
  const result = await readAccountRemainingCreditsUseCase('user_1', {
    getRemainingCredits: async () => 12,
  });

  assert.equal(result, 12);
});

test('updateProfileUseCase 写入 profile 并返回 action result', async () => {
  let updated: Record<string, unknown> | null = null;

  const result = await updateProfileUseCase(
    {
      userId: 'user_1',
      name: 'Bin',
      image: '/avatar.png',
    },
    {
      updateUser: async (_userId, payload) => {
        updated = payload;
        return {};
      },
    },
    'updated',
    '/settings/profile'
  );

  assert.deepEqual(updated, { name: 'Bin', image: '/avatar.png' });
  assert.deepEqual(result, {
    status: 'success',
    message: 'updated',
    redirect_url: '/settings/profile',
  });
});

test('listOwnApikeysUseCase 返回分页结果', async () => {
  const result = await listOwnApikeysUseCase(
    {
      userId: 'user_1',
      page: 2,
      limit: 20,
    },
    {
      getApikeys: async () => [{ id: 'key_1', userId: 'user_1' }] as never,
      getApikeysCount: async () => 3,
    }
  );

  assert.equal(result.total, 3);
  assert.equal(result.data.length, 1);
});

test('listOwnCreditsUseCase 返回分页 credits 结果', async () => {
  const result = await listOwnCreditsUseCase(
    {
      userId: 'user_1',
      transactionType: ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT,
      page: 1,
      limit: 10,
    },
    {
      getCredits: async (params) => {
        assert.equal(params.status, ACCOUNT_CREDIT_ACTIVE_STATUS);
        assert.equal(
          params.transactionType,
          ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT
        );
        return [{ id: 'credit_1', userId: 'user_1', credits: 5 }];
      },
      getCreditsCount: async (params) => {
        assert.equal(params.status, ACCOUNT_CREDIT_ACTIVE_STATUS);
        assert.equal(
          params.transactionType,
          ACCOUNT_CREDIT_TRANSACTION_TYPE.GRANT
        );
        return 1;
      },
    }
  );

  assert.equal(result.total, 1);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0]?.id, 'credit_1');
});

test('requireOwnedApikeyUseCase 拒绝非本人 apikey', async () => {
  const result = await requireOwnedApikeyUseCase(
    {
      apikeyId: 'key_1',
      userId: 'user_1',
    },
    {
      findApikeyById: async () =>
        ({
          id: 'key_1',
          userId: 'user_2',
        }) as never,
    }
  );

  assert.equal(result, null);
});

test('createOwnApikeyUseCase 创建 key 并返回 action result', async () => {
  let created: Record<string, unknown> | null = null;

  const result = await createOwnApikeyUseCase(
    {
      userId: 'user_1',
      title: 'local',
    },
    {
      createApikey: async (record) => {
        created = record as Record<string, unknown>;
        return record as never;
      },
      createId: () => 'id_1',
      createSecretKey: () => 'sk-secret',
    },
    'API Key created',
    '/settings/apikeys'
  );

  assert.equal(created?.id, 'id_1');
  assert.equal(created?.key, 'sk-secret');
  assert.deepEqual(result, {
    status: 'success',
    message: 'API Key created',
    redirect_url: '/settings/apikeys',
  });
});

test('renameOwnApikeyUseCase 更新 title', async () => {
  let updated: Record<string, unknown> | null = null;

  const result = await renameOwnApikeyUseCase(
    {
      apikeyId: 'key_1',
      userId: 'user_1',
      title: 'new title',
    },
    {
      findApikeyById: async () =>
        ({
          id: 'key_1',
          userId: 'user_1',
        }) as never,
      updateApikey: async (_id, payload) => {
        updated = payload;
        return {} as never;
      },
    },
    'API Key updated',
    '/settings/apikeys'
  );

  assert.deepEqual(updated, { title: 'new title' });
  assert.equal(result?.message, 'API Key updated');
});

test('deleteOwnApikeyUseCase 软删除 key', async () => {
  let updated: Record<string, unknown> | null = null;

  const result = await deleteOwnApikeyUseCase(
    {
      apikeyId: 'key_1',
      userId: 'user_1',
    },
    {
      findApikeyById: async () =>
        ({
          id: 'key_1',
          userId: 'user_1',
        }) as never,
      updateApikey: async (_id, payload) => {
        updated = payload;
        return {} as never;
      },
    },
    'API Key deleted',
    '/settings/apikeys'
  );

  assert.equal(updated?.status, 'deleted');
  assert.equal(result?.message, 'API Key deleted');
});
