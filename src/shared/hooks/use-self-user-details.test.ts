import assert from 'node:assert/strict';
import test from 'node:test';

import { RequestIdError } from '@/shared/lib/request-id';

import {
  loadSelfUserDetails,
  resolveSelfUserDetailsForAction,
} from './use-self-user-details';

test('loadSelfUserDetails 在 502 时自动重试一次', async () => {
  let attempts = 0;

  const details = await loadSelfUserDetails({
    fetchSelfUserDetails: async () => {
      attempts += 1;

      if (attempts === 1) {
        throw new RequestIdError('bad gateway', 'req_1', { status: 502 });
      }

      return {
        isAdmin: false,
        credits: { remainingCredits: 3, expiresAt: null },
        currentSubscriptionProductId: null,
      };
    },
  });

  assert.equal(attempts, 2);
  assert.deepEqual(details, {
    isAdmin: false,
    credits: { remainingCredits: 3, expiresAt: null },
    currentSubscriptionProductId: null,
  });
});

test('loadSelfUserDetails 对 401 不重试', async () => {
  let attempts = 0;

  await assert.rejects(
    loadSelfUserDetails({
      fetchSelfUserDetails: async () => {
        attempts += 1;
        throw new RequestIdError('unauthorized', 'req_2', { status: 401 });
      },
    }),
    (error: unknown) =>
      error instanceof RequestIdError && error.status === 401
  );

  assert.equal(attempts, 1);
});

test('resolveSelfUserDetailsForAction 在已有详情时不重复加载', async () => {
  let attempts = 0;
  const details = {
    isAdmin: false,
    credits: { remainingCredits: 9, expiresAt: null },
    currentSubscriptionProductId: 'pro',
  };

  const result = await resolveSelfUserDetailsForAction({
    currentDetails: details,
    loadDetails: async () => {
      attempts += 1;
      return details;
    },
  });

  assert.equal(result.status, 'ready');
  assert.deepEqual(result.status === 'ready' ? result.details : null, details);
  assert.equal(attempts, 0);
});

test('resolveSelfUserDetailsForAction 把 401 映射为 auth_required', async () => {
  const result = await resolveSelfUserDetailsForAction({
    currentDetails: null,
    loadDetails: async () => {
      throw new RequestIdError('unauthorized', 'req_3', { status: 401 });
    },
  });

  assert.deepEqual(result, { status: 'auth_required' });
});

test('resolveSelfUserDetailsForAction 保留非 401 错误供页面显示明确错误态', async () => {
  const error = new RequestIdError('service unavailable', 'req_4', {
    status: 503,
  });

  const result = await resolveSelfUserDetailsForAction({
    currentDetails: null,
    loadDetails: async () => {
      throw error;
    },
  });

  assert.equal(result.status, 'error');
  assert.equal(result.status === 'error' ? result.error : null, error);
});
