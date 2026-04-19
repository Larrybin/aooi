import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSessionViaAuthApi,
  isTerminalAuthErrorUrl,
  waitForTerminalAuthErrorPage,
} from '../../src/testing/auth-spike.browser';

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

test('isTerminalAuthErrorUrl 只接受最终错误页，不接受 auth 中间态', () => {
  assert.equal(
    isTerminalAuthErrorUrl(
      'http://localhost:8787/api/auth/callback/google?error=access_denied'
    ),
    false
  );
  assert.equal(
    isTerminalAuthErrorUrl(
      'http://localhost:8787/api/auth/error?error=access_denied'
    ),
    false
  );
  assert.equal(
    isTerminalAuthErrorUrl(
      'http://localhost:8787/sign-in?callbackUrl=%2Fsettings%2Fprofile&error=access_denied'
    ),
    true
  );
  assert.equal(
    isTerminalAuthErrorUrl(
      'http://localhost:8787/?error=please_restart_the_process'
    ),
    true
  );
});

test('waitForTerminalAuthErrorPage 不会在 callback 中间态提前通过', async () => {
  const seen: string[] = [];
  const fakePage = {
    async waitForURL(
      predicate: (url: URL) => boolean,
      options: { timeout: number; waitUntil: string }
    ) {
      const callbackUrl = new URL(
        'http://localhost:8787/api/auth/callback/google?error=access_denied'
      );
      const authErrorUrl = new URL(
        'http://localhost:8787/api/auth/error?error=access_denied'
      );
      const finalUrl = new URL(
        'http://localhost:8787/?error=please_restart_the_process'
      );
      seen.push(
        `${predicate(callbackUrl)}`,
        `${predicate(authErrorUrl)}`,
        `${predicate(finalUrl)}`
      );
      assert.deepEqual(seen, ['false', 'false', 'true']);
      assert.equal(options.timeout, 20_000);
      assert.equal(options.waitUntil, 'commit');
    },
  };

  await waitForTerminalAuthErrorPage(fakePage as never);
});
