import assert from 'node:assert/strict';
import test from 'node:test';

import {
  hasTaskTimedOut,
  shouldSkipTaskPoll,
} from './use-ai-generation-task';

test('hasTaskTimedOut: 超时阈值到达后返回 true', () => {
  assert.equal(
    hasTaskTimedOut({
      startedAt: 0,
      now: 10_001,
      timeoutMs: 10_000,
    }),
    true
  );
  assert.equal(
    hasTaskTimedOut({
      startedAt: 0,
      now: 10_000,
      timeoutMs: 10_000,
    }),
    false
  );
});

test('shouldSkipTaskPoll: 并发 inFlight 时跳过轮询', () => {
  assert.equal(
    shouldSkipTaskPoll({
      taskId: 'task_1',
      cancelled: false,
      inFlight: true,
    }),
    true
  );
  assert.equal(
    shouldSkipTaskPoll({
      taskId: 'task_1',
      cancelled: false,
      inFlight: false,
    }),
    false
  );
});
