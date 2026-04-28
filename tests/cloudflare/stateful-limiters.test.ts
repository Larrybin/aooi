import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import {
  buildSiteScopedLimiterBucket,
  buildStatefulLimiterObjectName,
  CloudflareDualConcurrencyLimiter,
  CloudflareQuotaLimiter,
} from '@/shared/platform/cloudflare/stateful-limiters';

import { StatefulLimitersDurableObject } from '../../cloudflare/workers/stateful-limiters';

type FakeStorage = {
  deleteCalls: string[][];
  getCalls: string[];
  listCallCount: number;
  map: Map<string, unknown>;
  putCalls: Array<{ key: string; value: unknown }>;
};

function createFakeStorage(
  initialEntries: Array<[string, unknown]> = []
): DurableObjectStorage & FakeStorage {
  const map = new Map(initialEntries);
  const getCalls: string[] = [];
  const putCalls: Array<{ key: string; value: unknown }> = [];
  const deleteCalls: string[][] = [];
  let listCallCount = 0;

  return {
    map,
    getCalls,
    putCalls,
    deleteCalls,
    get listCallCount() {
      return listCallCount;
    },
    async get(key: string) {
      getCalls.push(key);
      return map.get(key);
    },
    async put(key: string, value: unknown) {
      putCalls.push({ key, value });
      map.set(key, value);
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      deleteCalls.push(list);
      for (const key of list) {
        map.delete(key);
      }
      return list.length;
    },
    async list() {
      listCallCount += 1;
      return new Map(map);
    },
  } as unknown as DurableObjectStorage & FakeStorage;
}

function createDurableObject(storage: DurableObjectStorage) {
  return new StatefulLimitersDurableObject(
    { storage } as DurableObjectState,
    {} as CloudflareEnv
  );
}

function createRequest(body: Record<string, unknown>) {
  return new Request('https://stateful-limiters.internal', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function createNamespaceBackedByStateWorker() {
  const storages = new Map<string, DurableObjectStorage & FakeStorage>();

  return {
    idFromName(name: string) {
      return name;
    },
    get(id: string) {
      let storage = storages.get(id);
      if (!storage) {
        storage = createFakeStorage();
        storages.set(id, storage);
      }

      const durableObject = createDurableObject(storage);
      return {
        fetch: async (_input: RequestInfo | URL, init?: RequestInit) => {
          const request = new Request(
            'https://stateful-limiters.internal',
            init
          );
          return await durableObject.fetch(request);
        },
      };
    },
  } as unknown as DurableObjectNamespace;
}

test('buildStatefulLimiterObjectName 为单 key 与 bucket 级 limiter 生成不同 DO 名称', () => {
  assert.equal(
    buildStatefulLimiterObjectName('api.send-email', 'user-1'),
    `scope:${site.key}:api.send-email:user-1`
  );
  assert.equal(
    buildStatefulLimiterObjectName('api.storage-upload'),
    `bucket:${site.key}:api.storage-upload`
  );
});

test('buildSiteScopedLimiterBucket 自动附加 site.key 作用域', () => {
  assert.equal(
    buildSiteScopedLimiterBucket('api.send-email'),
    `${site.key}:api.send-email`
  );
});

test('STATEFUL_LIMITERS 单 key 路径只对当前 key 做惰性过期，不再扫描全桶', async () => {
  const storage = createFakeStorage([
    [
      'user-1',
      {
        bucket: 'api.email-test',
        scopeKey: 'user-1',
        lastActionAt: null,
        windowStartedAt: 1_000,
        count: 2,
        inflight: 0,
        expiresAt: 1_500,
      },
    ],
    [
      'user-2',
      {
        bucket: 'api.email-test',
        scopeKey: 'user-2',
        lastActionAt: null,
        windowStartedAt: 1_000,
        count: 1,
        inflight: 0,
        expiresAt: 1_500,
      },
    ],
  ]);
  const durableObject = createDurableObject(storage);

  const response = await durableObject.fetch(
    createRequest({
      action: 'quota.acquire',
      bucket: 'api.email-test',
      canonicalBucket: 'api.email-test',
      key: 'user-1',
      now: 2_000,
      config: {
        bucket: 'api.email-test',
        windowMs: 5 * 60 * 1000,
        maxAttempts: 3,
        maxConcurrent: 1,
      },
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { allowed: true });
  assert.equal(storage.listCallCount, 0);
  assert.deepEqual(storage.getCalls, ['user-1']);
  assert.equal(storage.map.has('user-2'), true);
  assert.equal(storage.map.has('user-1'), true);
});

test('STATEFUL_LIMITERS dual concurrency 只访问 __global__ 与当前 key，不再扫描全桶', async () => {
  const storage = createFakeStorage([
    [
      '__global__',
      {
        bucket: 'api.storage-upload',
        scopeKey: '__global__',
        lastActionAt: null,
        windowStartedAt: null,
        count: 0,
        inflight: 1,
        expiresAt: 5_000,
      },
    ],
    [
      'user-1',
      {
        bucket: 'api.storage-upload',
        scopeKey: 'user-1',
        lastActionAt: null,
        windowStartedAt: null,
        count: 0,
        inflight: 1,
        expiresAt: 5_000,
      },
    ],
    [
      'user-2',
      {
        bucket: 'api.storage-upload',
        scopeKey: 'user-2',
        lastActionAt: null,
        windowStartedAt: null,
        count: 0,
        inflight: 1,
        expiresAt: 1_000,
      },
    ],
  ]);
  const durableObject = createDurableObject(storage);

  const response = await durableObject.fetch(
    createRequest({
      action: 'dual.release',
      bucket: 'api.storage-upload',
      canonicalBucket: 'api.storage-upload',
      key: 'user-1',
      now: 2_000,
      config: {
        bucket: 'api.storage-upload',
        maxGlobal: 4,
        maxPerKey: 2,
        leaseMs: 15 * 60 * 1000,
      },
    })
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(storage.listCallCount, 0);
  assert.deepEqual(storage.getCalls, ['__global__', 'user-1']);
  assert.equal(storage.map.has('user-2'), true);
});

test('Cloudflare limiter client 与 state worker 之间的动作协议保持兼容', async () => {
  const namespace = createNamespaceBackedByStateWorker();
  const quotaLimiter = new CloudflareQuotaLimiter(
    {
      bucket: 'api.email-test',
      windowMs: 5 * 60 * 1000,
      maxAttempts: 1,
      maxConcurrent: 1,
    },
    () => 1_000,
    namespace
  );
  const dualLimiter = new CloudflareDualConcurrencyLimiter(
    {
      bucket: 'api.storage-upload',
      maxGlobal: 1,
      maxPerKey: 1,
      leaseMs: 15 * 60 * 1000,
    },
    () => 2_000,
    namespace
  );

  const firstQuota = await quotaLimiter.acquire('user-1', 1_000);
  const secondQuota = await quotaLimiter.acquire('user-1', 1_001);
  const firstDual = await dualLimiter.acquire('user-1', 2_000);
  const secondDual = await dualLimiter.acquire('user-2', 2_001);
  await dualLimiter.release('user-1', 2_002);
  const thirdDual = await dualLimiter.acquire('user-2', 2_003);

  assert.deepEqual(firstQuota, { allowed: true });
  assert.deepEqual(secondQuota, {
    allowed: false,
    reason: 'rate_limited',
  });
  assert.equal(firstDual, true);
  assert.equal(secondDual, false);
  assert.equal(thirdDual, true);
});
