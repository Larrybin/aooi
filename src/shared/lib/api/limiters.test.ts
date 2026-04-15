import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CooldownLimiter,
  DualConcurrencyLimiter,
  FixedWindowAttemptLimiter,
  FixedWindowQuotaLimiter,
} from './limiters';

test('CooldownLimiter: 冷却窗口内拒绝并返回 retryAfterSeconds', () => {
  let now = 1_000;
  const limiter = new CooldownLimiter({
    minIntervalMs: 1_000,
    ttlMs: 10_000,
    maxEntries: 100,
    now: () => now,
  });

  assert.equal(limiter.checkAndConsume('u1').allowed, true);

  now = 1_500;
  const denied = limiter.check('u1');
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 1);

  now = 2_100;
  assert.equal(limiter.check('u1').allowed, true);
});

test('CooldownLimiter: rollback 只撤销同一时间戳写入', () => {
  const limiter = new CooldownLimiter({
    minIntervalMs: 1_000,
    ttlMs: 10_000,
    maxEntries: 100,
  });

  const first = limiter.consume('u1', 1_000);
  const second = limiter.consume('u1', 2_000);
  limiter.rollback('u1', first);
  assert.equal(limiter.check('u1', 2_100).allowed, false);

  limiter.rollback('u1', second);
  assert.equal(limiter.check('u1', 2_100).allowed, true);
});

test('CooldownLimiter: TTL 过期后自动清理并放行', () => {
  let now = 1_000;
  const limiter = new CooldownLimiter({
    minIntervalMs: 10_000,
    ttlMs: 1_000,
    maxEntries: 100,
    cleanupEvery: 0,
    now: () => now,
  });

  limiter.consume('u1');
  now = 2_500;
  assert.equal(limiter.check('u1').allowed, true);
});

test('CooldownLimiter: 超过 maxEntries 后会裁剪旧 key', () => {
  let now = 1_000;
  const limiter = new CooldownLimiter({
    minIntervalMs: 10_000,
    ttlMs: 60_000,
    maxEntries: 2,
    cleanupEvery: 0,
    now: () => now,
  });

  limiter.consume('u1');
  now = 1_001;
  limiter.consume('u2');
  now = 1_002;
  limiter.consume('u3');

  now = 1_003;
  assert.equal(limiter.check('u1').allowed, true);
});

test('FixedWindowAttemptLimiter: 达到上限后拒绝，成功后可清空', () => {
  let now = 1_000;
  const limiter = new FixedWindowAttemptLimiter({
    windowMs: 10_000,
    maxAttempts: 3,
    maxEntries: 100,
    now: () => now,
  });

  assert.equal(limiter.recordFailure('u1').attempts, 1);
  assert.equal(limiter.recordFailure('u1').attempts, 2);
  const third = limiter.recordFailure('u1');
  assert.equal(third.attempts, 3);
  assert.equal(typeof third.retryAfterSeconds, 'number');

  const denied = limiter.check('u1');
  assert.equal(denied.allowed, false);
  assert.equal(typeof denied.retryAfterSeconds, 'number');

  limiter.clear('u1');
  assert.equal(limiter.check('u1').allowed, true);

  now = 20_000;
  assert.equal(limiter.check('u1').allowed, true);
});

test('FixedWindowAttemptLimiter: 窗口过期后自动放行', () => {
  let now = 1_000;
  const limiter = new FixedWindowAttemptLimiter({
    windowMs: 1_000,
    maxAttempts: 1,
    maxEntries: 100,
    cleanupEvery: 0,
    now: () => now,
  });

  limiter.recordFailure('u1');
  assert.equal(limiter.check('u1').allowed, false);

  now = 2_001;
  assert.equal(limiter.check('u1').allowed, true);
});

test('FixedWindowAttemptLimiter: 超过 maxEntries 后会裁剪旧 key', () => {
  let now = 1_000;
  const limiter = new FixedWindowAttemptLimiter({
    windowMs: 10_000,
    maxAttempts: 1,
    maxEntries: 2,
    cleanupEvery: 0,
    now: () => now,
  });

  limiter.recordFailure('u1');
  now = 1_001;
  limiter.recordFailure('u2');
  now = 1_002;
  limiter.recordFailure('u3');

  now = 1_003;
  assert.equal(limiter.check('u1').allowed, true);
});

test('FixedWindowQuotaLimiter: 同时覆盖次数上限和并发上限', () => {
  let now = 1_000;
  const limiter = new FixedWindowQuotaLimiter({
    windowMs: 10_000,
    maxAttempts: 2,
    maxConcurrent: 1,
    maxEntries: 100,
    now: () => now,
  });

  assert.equal(limiter.acquire('u1').allowed, true);
  const concurrencyDenied = limiter.acquire('u1');
  assert.equal(concurrencyDenied.allowed, false);
  assert.equal(concurrencyDenied.reason, 'concurrency_limit');

  limiter.release('u1');
  assert.equal(limiter.acquire('u1').allowed, true);
  limiter.release('u1');

  const rateDenied = limiter.acquire('u1');
  assert.equal(rateDenied.allowed, false);
  assert.equal(rateDenied.reason, 'rate_limited');

  now = 20_000;
  assert.equal(limiter.acquire('u1').allowed, true);
});

test('DualConcurrencyLimiter: 同时限制全局并发和单 key 并发', () => {
  const limiter = new DualConcurrencyLimiter({ maxGlobal: 2, maxPerKey: 1 });

  assert.equal(limiter.acquire('u1'), true);
  assert.equal(limiter.acquire('u1'), false);
  assert.equal(limiter.acquire('u2'), true);
  assert.equal(limiter.acquire('u3'), false);

  limiter.release('u1');
  assert.equal(limiter.acquire('u3'), true);
});
