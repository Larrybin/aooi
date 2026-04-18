import assert from 'node:assert/strict';
import test from 'node:test';

import { AITaskStatus } from '@/extensions/ai';
import {
  CooldownLimiter,
  DualConcurrencyLimiter,
  FixedWindowAttemptLimiter,
  FixedWindowQuotaLimiter,
} from '@/shared/lib/api/limiters';
import { createMemoryRateLimitStore } from '@/shared/lib/api/rate-limit-store';

import { createAiQueryPostHandler } from './ai/query/route';
import { createSendEmailPostHandler } from './email/send-email/route';
import { createEmailTestPostHandler } from './email/test/route';
import { createVerifyCodePostHandler } from './email/verify-code/route';
import { createStorageUploadImagePostHandler } from './storage/upload-image/route';

function createLog() {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function createApiContextStub(input: {
  body: unknown;
  userId?: string;
}) {
  return {
    req: new Request('http://localhost'),
    log: createLog(),
    requestId: 'test-request-id',
    route: '/api/test',
    method: 'POST',
    parseJson: async () => input.body,
    parseQuery: () => ({}),
    parseParams: async () => ({}),
    requireUser: async () => ({ id: input.userId ?? 'u1' }),
    requirePermission: async () => undefined,
  };
}

function createSuccessUploadResult() {
  return [{ key: 'k1', url: 'https://cdn.example.com/k1', filename: 'a.png' }];
}

async function waitForCondition(
  condition: () => boolean,
  message: string,
  timeoutMs = 2_000
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (condition()) {
      return;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  assert.fail(message);
}

test('send-email 路由限流契约: 冷却窗口内返回 429', async () => {
  const handler = createSendEmailPostHandler({
    getApiContext: () =>
      createApiContextStub({
        body: { emails: 'a@example.com', subject: 'hello' },
      }),
    getEmailService: async () => ({
      sendEmail: async () => ({
        success: true,
        provider: 'resend',
        messageId: 'm1',
      }),
    }),
    persistSettingsEmailVerificationCode: async () => ({
      id: 'v1',
      identifier: 'id-1',
      expiresAt: new Date('2026-04-15T00:00:00.000Z'),
    }),
    deleteEmailVerificationCodeById: async () => undefined,
    deleteEmailVerificationCodesByIdentifierExceptId: async () => undefined,
    buildVerificationCodeEmailPayload: async () => ({}),
    rateLimiter: new CooldownLimiter({
      bucket: 'test.route.send-email',
      minIntervalMs: 60_000,
      ttlMs: 15 * 60 * 1000,
      store: createMemoryRateLimitStore(),
    }),
    randomInt: () => 123456,
    now: () => 1_000,
  });

  const req = new Request('http://localhost/api/email/send-email', {
    method: 'POST',
  });

  const first = await handler(req);
  assert.equal(first.status, 200);

  const second = await handler(req);
  assert.equal(second.status, 429);
  const body = (await second.json()) as {
    message: string;
    data: { retryAfterSeconds?: number };
  };
  assert.equal(body.message, 'too many requests');
  assert.equal(body.data.retryAfterSeconds, 60);
});

test('ai/query 路由限流契约: 间隔不足时阻止 provider query', async () => {
  let queryCalls = 0;
  const task = {
    id: 'task-1',
    taskId: 'provider-task-1',
    userId: 'u1',
    provider: 'mock-provider',
    status: AITaskStatus.PROCESSING,
    model: null,
    prompt: null,
    taskInfo: null,
    taskResult: null,
    creditId: null,
  };

  const handler = createAiQueryPostHandler({
    requireAiEnabled: async () => undefined,
    getApiContext: () =>
      createApiContextStub({
        body: { taskId: 'task-1' },
        userId: 'u1',
      }),
    findAITaskById: async () => task,
    updateAITaskById: async () => task,
    getAIService: async () => ({
      getProvider: () => ({
        query: async () => {
          queryCalls += 1;
          return { taskStatus: AITaskStatus.PROCESSING };
        },
      }),
    }),
    rateLimiter: new CooldownLimiter({
      bucket: 'test.route.ai-query',
      minIntervalMs: 4_000,
      ttlMs: 60 * 60 * 1000,
      store: createMemoryRateLimitStore(),
    }),
    now: () => 1_000,
  });

  const req = new Request('http://localhost/api/ai/query', { method: 'POST' });

  const first = await handler(req);
  assert.equal(first.status, 200);
  assert.equal(queryCalls, 1);

  const second = await handler(req);
  assert.equal(second.status, 200);
  assert.equal(queryCalls, 1);
});

test('verify-code 路由限流契约: 达到失败上限后返回 429', async () => {
  const handler = createVerifyCodePostHandler({
    getApiContext: () =>
      createApiContextStub({
        body: { email: 'a@example.com', code: '000000' },
      }),
    consumeSettingsEmailVerificationCode: async () => ({
      ok: false as const,
      reason: 'mismatch' as const,
    }),
    attemptLimiter: new FixedWindowAttemptLimiter({
      bucket: 'test.route.verify-code',
      windowMs: 15 * 60 * 1000,
      maxAttempts: 5,
      store: createMemoryRateLimitStore(),
    }),
    now: () => 1_000,
  });

  const req = new Request('http://localhost/api/email/verify-code', {
    method: 'POST',
  });

  for (let index = 0; index < 4; index += 1) {
    const response = await handler(req);
    assert.equal(response.status, 400);
  }

  const denied = await handler(req);
  assert.equal(denied.status, 429);
  const body = (await denied.json()) as {
    message: string;
    data: { retryAfterSeconds?: number };
  };
  assert.equal(body.message, 'too many attempts');
  assert.equal(typeof body.data.retryAfterSeconds, 'number');
});

test('email/test 路由限流契约: 并发优先，其次窗口次数', async () => {
  let releaseFirst: ((value: unknown) => void) | null = null;
  let holdFirst = true;

  const handler = createEmailTestPostHandler({
    getApiContext: () =>
      createApiContextStub({
        body: { emails: ['a@example.com'], subject: 'hello' },
      }),
    getEmailService: async () => ({
      sendEmail: async () => {
        if (holdFirst) {
          holdFirst = false;
          return await new Promise((resolve) => {
            releaseFirst = resolve;
          });
        }
        return {
          success: true,
          provider: 'resend',
          messageId: 'ok',
        };
      },
    }),
    buildVerificationCodeEmailPayload: async () => ({}),
    quotaLimiter: new FixedWindowQuotaLimiter({
      bucket: 'test.route.email-test',
      windowMs: 5 * 60 * 1000,
      maxAttempts: 3,
      maxConcurrent: 1,
      store: createMemoryRateLimitStore(),
    }),
    randomInt: () => 123456,
    now: () => 1_000,
  });

  const req = new Request('http://localhost/api/email/test', { method: 'POST' });

  const firstPending = handler(req);
  await waitForCondition(
    () => releaseFirst !== null,
    '首个 email/test 请求未进入并发占用态'
  );

  const concurrencyDenied = await handler(req);
  assert.equal(concurrencyDenied.status, 429);

  releaseFirst?.({
    success: true,
    provider: 'resend',
    messageId: 'first',
  });
  const first = await firstPending;
  assert.equal(first.status, 200);

  const second = await handler(req);
  assert.equal(second.status, 200);

  const third = await handler(req);
  assert.equal(third.status, 200);

  const rateDenied = await handler(req);
  assert.equal(rateDenied.status, 429);
  const body = (await rateDenied.json()) as { message: string };
  assert.equal(body.message, 'rate limited');
});

test('storage/upload-image 路由并发契约: 全局与单用户上限同时生效', async () => {
  const pendingResolvers: Array<(value: unknown) => void> = [];
  let activeUploads = 0;
  const concurrencyLimiter = new DualConcurrencyLimiter({
    bucket: 'test.route.storage-upload',
    maxGlobal: 4,
    maxPerKey: 2,
    leaseMs: 15 * 60 * 1000,
    store: createMemoryRateLimitStore(),
  });

  const handler = createStorageUploadImagePostHandler({
    getApiContext: (req: Request) =>
      createApiContextStub({
        body: {},
        userId: req.headers.get('x-test-user-id') || 'u1',
      }),
    readUploadRequestInput: async () => ({
      entries: [{ filename: 'a.png' }],
      files: [new File([new Uint8Array([1, 2, 3])], 'a.png')],
      runtimePlatform: 'node',
    }),
    uploadImageFiles: async () =>
      await new Promise((resolve) => {
        pendingResolvers.push(resolve);
      }),
    getStorageService: async () => ({
      uploadFile: async () => ({
        success: true,
        provider: 'r2',
        key: 'k1',
        url: 'https://cdn.example.com/k1',
      }),
    }),
    concurrencyLimiter: {
      acquire: async (key: string) => {
        const allowed = await concurrencyLimiter.acquire(key);
        if (allowed) {
          activeUploads += 1;
        }
        return allowed;
      },
      release: async (key: string) => {
        await concurrencyLimiter.release(key);
        activeUploads = Math.max(0, activeUploads - 1);
      },
    },
  });

  const createReq = (userId: string) =>
    new Request('http://localhost/api/storage/upload-image', {
      method: 'POST',
      headers: { 'x-test-user-id': userId },
    });

  const u1First = handler(createReq('u1'));
  await waitForCondition(
    () => activeUploads === 1,
    'u1 第一个上传未进入并发占用态'
  );
  const u1Second = handler(createReq('u1'));
  await waitForCondition(
    () => activeUploads === 2,
    'u1 第二个上传未进入并发占用态'
  );

  const deniedPerUser = await handler(createReq('u1'));
  assert.equal(deniedPerUser.status, 429);

  const u2First = handler(createReq('u2'));
  await waitForCondition(
    () => activeUploads === 3,
    'u2 第一个上传未进入并发占用态'
  );
  const u2Second = handler(createReq('u2'));
  await waitForCondition(
    () => activeUploads === 4,
    'u2 第二个上传未进入并发占用态'
  );

  const deniedGlobal = await handler(createReq('u3'));
  assert.equal(deniedGlobal.status, 429);

  await waitForCondition(
    () => pendingResolvers.length === 4,
    '并发上传未全部进入挂起态'
  );

  for (const resolve of pendingResolvers) {
    resolve(createSuccessUploadResult());
  }

  assert.equal((await u1First).status, 200);
  assert.equal((await u1Second).status, 200);
  assert.equal((await u2First).status, 200);
  assert.equal((await u2Second).status, 200);
});
