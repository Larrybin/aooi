import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRequestScopedAuthSessionReader,
  readSignedInUserIdentityFromCookieHeader,
} from './session-reader';

function createMemoizedCache() {
  return <Args extends [string | null], Result>(
    fn: (...args: Args) => Result
  ) => {
    const entries = new Map<string, Result>();

    return (...args: Args) => {
      const key = JSON.stringify(args);
      const cached = entries.get(key);
      if (cached !== undefined) {
        return cached;
      }

      const result = fn(...args);
      entries.set(key, result);
      return result;
    };
  };
}

test('createRequestScopedAuthSessionReader 在同一 cookieHeader 下复用一次 identity 查询', async () => {
  const calls: string[] = [];
  const reader = createRequestScopedAuthSessionReader(async (sessionToken) => {
    calls.push(sessionToken);
    return {
      id: 'user_123',
      name: 'Roller Rabbit',
      email: 'rabbit@example.com',
      image: null,
    };
  }, createMemoizedCache());

  const cookieHeader =
    'theme=dark; better-auth.session_token=session-token-123; locale=zh';

  const identity = await reader.getIdentity(cookieHeader);
  const snapshot = await reader.getSnapshot(cookieHeader);
  const identityAgain = await reader.getIdentity(cookieHeader);

  assert.deepEqual(identity, {
    id: 'user_123',
    name: 'Roller Rabbit',
    email: 'rabbit@example.com',
    image: null,
  });
  assert.deepEqual(snapshot, {
    name: 'Roller Rabbit',
    email: 'rabbit@example.com',
    image: null,
  });
  assert.deepEqual(identityAgain, identity);
  assert.deepEqual(calls, ['session-token-123']);
});

test('readSignedInUserIdentityFromCookieHeader 在无 session cookie 时零查询', async () => {
  let queryCount = 0;

  const result = await readSignedInUserIdentityFromCookieHeader(
    'theme=dark; locale=zh',
    async () => {
      queryCount += 1;
      return null;
    }
  );

  assert.equal(result, null);
  assert.equal(queryCount, 0);
});

test('readSignedInUserIdentityFromCookieHeader 会将 signed cookie 归一为原始 token', async () => {
  let tokenSeen: string | null = null;
  const signature = `${'A'.repeat(43)}=`;

  await readSignedInUserIdentityFromCookieHeader(
    `theme=dark; __Secure-better-auth.session_token=raw-session-token.${signature}; locale=zh`,
    async (sessionToken) => {
      tokenSeen = sessionToken;
      return null;
    }
  );

  assert.equal(tokenSeen, 'raw-session-token');
});
