import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildTrustedAuthOrigins,
  isLocalAuthRuntimeOrigin,
  resolveRuntimeAuthBaseUrl,
} from './runtime-origin';

test('isLocalAuthRuntimeOrigin 接受 localhost 的 Wrangler 动态端口', () => {
  assert.equal(isLocalAuthRuntimeOrigin('http://localhost:8788'), true);
});

test('isLocalAuthRuntimeOrigin 接受 127.0.0.1 的 Wrangler 动态端口', () => {
  assert.equal(isLocalAuthRuntimeOrigin('http://127.0.0.1:40123'), true);
});

test('isLocalAuthRuntimeOrigin 拒绝非本机 origin', () => {
  assert.equal(isLocalAuthRuntimeOrigin('https://example.com'), false);
});

test('buildTrustedAuthOrigins 会加入请求里的 localhost preview origin', () => {
  const request = new Request('http://localhost:8788/api/auth/sign-in/social', {
    headers: {
      origin: 'http://localhost:8788',
    },
  });

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
      allowLocalMockOrigins: true,
    }).sort(),
    [
      'http://127.0.0.1:8787',
      'http://localhost:8787',
      'http://localhost:8788',
      'https://accounts.google.com',
      'https://mamamiya.pdfreprinting.net',
    ].sort()
  );
});

test('buildTrustedAuthOrigins 会从 Host 头识别 Wrangler preview origin', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/sign-in/social',
    {
      headers: {
        host: 'localhost:8787',
      },
    }
  );

  assert.equal(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }).includes('http://localhost:8787'),
    true
  );
});

test('resolveRuntimeAuthBaseUrl 优先使用请求里的 localhost preview origin', () => {
  const request = new Request('http://localhost:8788/api/auth/sign-in/social', {
    headers: {
      origin: 'http://localhost:8788',
    },
  });

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }),
    'http://localhost:8788'
  );
});

test('resolveRuntimeAuthBaseUrl 在 request.url 是配置域时仍优先使用本地 Host', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/sign-in/social',
    {
      headers: {
        host: 'localhost:8787',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }),
    'http://localhost:8787'
  );
});

test('buildTrustedAuthOrigins 会把同 host 的 http preview 变体收敛回 canonical https origin', () => {
  const request = new Request(
    'http://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        host: 'mamamiya.pdfreprinting.net',
      },
    }
  );

  assert.deepEqual(
    buildTrustedAuthOrigins({
      appUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }).sort(),
    ['https://accounts.google.com', 'https://mamamiya.pdfreprinting.net'].sort()
  );
});

test('resolveRuntimeAuthBaseUrl 会把同 host 的 http preview 变体收敛回 canonical https origin', () => {
  const request = new Request(
    'http://mamamiya.pdfreprinting.net/api/auth/get-session',
    {
      headers: {
        host: 'mamamiya.pdfreprinting.net',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }),
    'https://mamamiya.pdfreprinting.net'
  );
});

test('resolveRuntimeAuthBaseUrl 在 mock 模式优先使用请求 origin', () => {
  const request = new Request('https://localhost:8788/api/auth/sign-in/social', {
    headers: {
      origin: 'http://localhost:8788',
    },
  });

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://localhost:8788',
      preferRequestOrigin: true,
      request,
    }),
    'http://localhost:8788'
  );
});

test('resolveRuntimeAuthBaseUrl 不把第三方 referer 当成 runtime origin', () => {
  const request = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/callback/google',
    {
      headers: {
        referer: 'https://accounts.google.com/o/oauth2/auth',
        host: 'mamamiya.pdfreprinting.net',
      },
    }
  );

  assert.equal(
    resolveRuntimeAuthBaseUrl({
      defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
      request,
    }),
    'https://mamamiya.pdfreprinting.net'
  );
});

test('buildTrustedAuthOrigins 拒绝非 canonical 且非本地 preview origin', () => {
  const request = new Request('https://evil.example.com/api/auth/sign-in/social', {
    headers: {
      origin: 'https://evil.example.com',
    },
  });

  assert.throws(
    () =>
      buildTrustedAuthOrigins({
        appUrl: 'https://mamamiya.pdfreprinting.net',
        request,
      }),
    /Unexpected runtime auth origin/
  );
});

test('resolveRuntimeAuthBaseUrl 拒绝非 canonical 且非本地 preview origin', () => {
  const request = new Request('https://evil.example.com/api/auth/sign-in/social', {
    headers: {
      host: 'evil.example.com',
    },
  });

  assert.throws(
    () =>
      resolveRuntimeAuthBaseUrl({
        defaultBaseUrl: 'https://mamamiya.pdfreprinting.net',
        request,
      }),
    /Unexpected runtime auth origin/
  );
});
