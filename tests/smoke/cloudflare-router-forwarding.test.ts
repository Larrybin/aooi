import assert from 'node:assert/strict';
import test from 'node:test';

import { buildForwardedWorkerRequest } from '../../cloudflare/workers/router-forwarding';

test('router 转发会把 canonicalized middleware request 归一化回本地 preview origin', () => {
  const originalRequest = new Request(
    'http://localhost:8787/api/auth/sign-up/email',
    {
      method: 'POST',
      headers: {
        origin: 'http://localhost:8787',
      },
      body: JSON.stringify({ email: 'debug@example.com' }),
    }
  );
  const middlewareRequest = new Request(
    'https://mamamiya.pdfreprinting.net/api/auth/sign-up/email',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'debug@example.com' }),
    }
  );

  const forwardedRequest = buildForwardedWorkerRequest(
    originalRequest,
    middlewareRequest,
    {} as never,
    'public-web'
  );

  assert.equal(
    forwardedRequest.url,
    'http://localhost:8787/api/auth/sign-up/email'
  );
  assert.equal(forwardedRequest.headers.get('origin'), 'http://localhost:8787');
  assert.equal(
    forwardedRequest.headers.get('x-forwarded-host'),
    'localhost:8787'
  );
  assert.equal(forwardedRequest.headers.get('x-forwarded-proto'), 'http');
});

test('router 转发会保留 middleware 决定的 rewrite path 和 query', () => {
  const originalRequest = new Request('http://127.0.0.1:8787/docs');
  const middlewareRequest = new Request(
    'https://mamamiya.pdfreprinting.net/en/docs?from=middleware=1'
  );

  const forwardedRequest = buildForwardedWorkerRequest(
    originalRequest,
    middlewareRequest,
    {} as never,
    'public-web'
  );

  assert.equal(
    forwardedRequest.url,
    'http://127.0.0.1:8787/en/docs?from=middleware=1'
  );
  assert.equal(
    forwardedRequest.headers.get('x-forwarded-host'),
    '127.0.0.1:8787'
  );
});

test('router 在本地多 worker topology 下会把请求 URL 指向目标 worker 本地地址', () => {
  const originalRequest = new Request('http://127.0.0.1:8787/pricing');
  const middlewareRequest = new Request(
    'https://mamamiya.pdfreprinting.net/en/pricing?from=middleware=1'
  );

  const forwardedRequest = buildForwardedWorkerRequest(
    originalRequest,
    middlewareRequest,
    {
      CF_LOCAL_PUBLIC_WEB_WORKER_URL: 'http://127.0.0.1:8788',
    } as never,
    'public-web'
  );

  assert.equal(
    forwardedRequest.url,
    'http://127.0.0.1:8788/en/pricing?from=middleware=1'
  );
  assert.equal(
    forwardedRequest.headers.get('x-forwarded-host'),
    '127.0.0.1:8787'
  );
  assert.equal(forwardedRequest.headers.get('origin'), 'http://127.0.0.1:8787');
});
