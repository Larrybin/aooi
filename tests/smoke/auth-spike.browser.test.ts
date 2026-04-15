import assert from 'node:assert/strict';
import test from 'node:test';

import { getSessionViaAuthApi } from './auth-spike.browser';

function createFakeResponse({
  status,
  bodyText,
  url = 'http://localhost:8787/api/auth/get-session',
}: {
  status: number;
  bodyText: string;
  url?: string;
}) {
  return {
    url: () => url,
    status: () => status,
    headers: () => ({ 'content-type': 'application/json' }),
    text: async () => bodyText,
  };
}

test('getSessionViaAuthApi 会对本地 preview 的瞬时 DB 500 重试并最终返回成功结果', async () => {
  let calls = 0;
  const context = {
    request: {
      async get() {
        calls += 1;
        if (calls === 1) {
          return createFakeResponse({
            status: 500,
            bodyText:
              '{"code":"DB_STARTUP_CHECK_FAILED","message":"MaxClientsInSessionMode"}',
          });
        }

        return createFakeResponse({
          status: 200,
          bodyText: '{"session":{"id":"s1"},"user":{"id":"u1"}}',
        });
      },
    },
  } as const;

  const observation = await getSessionViaAuthApi(
    context as never,
    'http://localhost:8787'
  );

  assert.equal(calls, 2);
  assert.equal(observation.status, 200);
  assert.equal(observation.sessionPresent, true);
  assert.equal(observation.userPresent, true);
});

test('getSessionViaAuthApi 不会对非本地 origin 的 500 做重试', async () => {
  let calls = 0;
  const context = {
    request: {
      async get() {
        calls += 1;
        return createFakeResponse({
          status: 500,
          bodyText: '{"message":"DB_STARTUP_CHECK_FAILED"}',
          url: 'https://example.com/api/auth/get-session',
        });
      },
    },
  } as const;

  const observation = await getSessionViaAuthApi(
    context as never,
    'https://example.com'
  );

  assert.equal(calls, 1);
  assert.equal(observation.status, 500);
});

test('getSessionViaAuthApi 会对本地 preview 的空体 500 做重试', async () => {
  let calls = 0;
  const context = {
    request: {
      async get() {
        calls += 1;
        if (calls === 1) {
          return createFakeResponse({
            status: 500,
            bodyText: '',
          });
        }

        return createFakeResponse({
          status: 200,
          bodyText: '{"session":null,"user":null}',
        });
      },
    },
  } as const;

  const observation = await getSessionViaAuthApi(
    context as never,
    'http://localhost:8787'
  );

  assert.equal(calls, 2);
  assert.equal(observation.status, 200);
});
