import assert from 'node:assert/strict';
import test from 'node:test';

import { hasEnoughCredits } from './use-credits-gate';

test('hasEnoughCredits: credits 足够时返回 true', () => {
  assert.equal(
    hasEnoughCredits(
      {
        isAdmin: false,
        credits: {
          remainingCredits: 20,
          expiresAt: null,
        },
        currentSubscriptionProductId: null,
      },
      10
    ),
    true
  );
});

test('hasEnoughCredits: credits 不足时返回 false', () => {
  assert.equal(
    hasEnoughCredits(
      {
        isAdmin: false,
        credits: {
          remainingCredits: 1,
          expiresAt: null,
        },
        currentSubscriptionProductId: null,
      },
      10
    ),
    false
  );
});
