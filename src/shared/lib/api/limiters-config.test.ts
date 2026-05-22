import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REMOVER_GUEST_JOB_LIMIT_CONFIG,
  REMOVER_GUEST_UPLOAD_LIMIT_CONFIG,
} from './limiters-config';

test('remover guest limiter config keeps strict anonymous abuse limits', () => {
  assert.equal(REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxAttempts, 4);
  assert.equal(REMOVER_GUEST_UPLOAD_LIMIT_CONFIG.maxConcurrent, 4);
  assert.equal(REMOVER_GUEST_JOB_LIMIT_CONFIG.maxAttempts, 2);
  assert.equal(REMOVER_GUEST_JOB_LIMIT_CONFIG.maxConcurrent, 2);
});
