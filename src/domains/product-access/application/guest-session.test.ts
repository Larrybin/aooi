import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGuestSessionCookie,
  createGuestSession,
  readGuestSession,
  resolveGuestSession,
  writeGuestSessionCookie,
} from './guest-session';

const COOKIE_NAME = 'product_guest';

function request(url: string, headers: HeadersInit = {}) {
  return new Request(url, { headers });
}

type WrittenCookie = Parameters<
  Parameters<typeof writeGuestSessionCookie>[0]['cookieStore']['set']
>[0];

test('resolveGuestSession creates a signed cookie-backed guest session', async () => {
  const session = await resolveGuestSession(request('https://example.com'), {
    cookieName: COOKIE_NAME,
    secret: 'test-secret',
    createId: () => 'anon_created_123',
  });

  assert.equal(session.anonymousSessionId, 'anon_created_123');
  assert.equal(session.shouldSetCookie, true);
  assert.match(session.cookieValue, /^anon_created_123\.[a-f0-9]{64}$/);
});

test('resolveGuestSession reuses only the configured signed guest cookie', async () => {
  const cookieValue = await buildGuestSessionCookie({
    anonymousSessionId: 'anon_cookie_123',
    secret: 'test-secret',
  });

  const session = await resolveGuestSession(
    request('https://example.com', {
      cookie: `${COOKIE_NAME}=${cookieValue}; other_guest=${cookieValue}`,
    }),
    {
      cookieName: COOKIE_NAME,
      secret: 'test-secret',
      createId: () => 'anon_new_123',
    }
  );
  const missing = await readGuestSession(
    request('https://example.com', {
      cookie: `other_guest=${cookieValue}`,
    }),
    {
      cookieName: COOKIE_NAME,
      secret: 'test-secret',
    }
  );

  assert.equal(session.anonymousSessionId, 'anon_cookie_123');
  assert.equal(session.shouldSetCookie, false);
  assert.equal(missing, null);
});

test('createGuestSession is stable for injected ids', async () => {
  const first = await createGuestSession({
    secret: 'test-secret',
    createId: () => 'anon_created_123',
  });
  const second = await createGuestSession({
    secret: 'test-secret',
    createId: () => 'anon_created_123',
  });

  assert.equal(first.anonymousSessionId, second.anonymousSessionId);
  assert.equal(first.cookieValue, second.cookieValue);
});

test('readGuestSession returns only a valid signed guest cookie', async () => {
  const cookieValue = await buildGuestSessionCookie({
    anonymousSessionId: 'anon_cookie_123',
    secret: 'test-secret',
  });

  assert.deepEqual(
    await readGuestSession(
      request('https://example.com', {
        cookie: `${COOKIE_NAME}=${cookieValue}`,
      }),
      { cookieName: COOKIE_NAME, secret: 'test-secret' }
    ),
    {
      anonymousSessionId: 'anon_cookie_123',
      cookieValue,
      shouldSetCookie: false,
    }
  );
  assert.equal(
    await readGuestSession(
      request('https://example.com', {
        cookie: `${COOKIE_NAME}=anon_cookie_123.bad`,
      }),
      { cookieName: COOKIE_NAME, secret: 'test-secret' }
    ),
    null
  );
});

test('writeGuestSessionCookie preserves secure production cookie attributes', () => {
  let written: WrittenCookie | undefined;

  writeGuestSessionCookie({
    cookieStore: {
      set: (cookie) => {
        written = cookie;
      },
    },
    req: request('https://example.com'),
    session: {
      anonymousSessionId: 'anon_cookie_123',
      cookieValue: 'anon_cookie_123.signature',
      shouldSetCookie: true,
    },
    cookieName: COOKIE_NAME,
    maxAgeSeconds: 123,
  });

  assert.deepEqual(written, {
    name: COOKIE_NAME,
    value: 'anon_cookie_123.signature',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 123,
  });
});

test('writeGuestSessionCookie preserves local and forwarded secure behavior', () => {
  const written: WrittenCookie[] = [];
  const cookieStore = {
    set: (cookie: WrittenCookie) => {
      written.push(cookie);
    },
  };
  const session = {
    anonymousSessionId: 'anon_cookie_123',
    cookieValue: 'anon_cookie_123.signature',
    shouldSetCookie: true,
  };

  writeGuestSessionCookie({
    cookieStore,
    req: request('http://localhost:3000'),
    session,
    cookieName: COOKIE_NAME,
    maxAgeSeconds: 123,
  });
  writeGuestSessionCookie({
    cookieStore,
    req: request('http://localhost:3000', {
      'x-forwarded-proto': 'https',
    }),
    session,
    cookieName: COOKIE_NAME,
    maxAgeSeconds: 123,
  });

  assert.equal(written[0]?.secure, false);
  assert.equal(written[1]?.secure, true);
});
