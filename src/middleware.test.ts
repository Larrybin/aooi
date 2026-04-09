import assert from 'node:assert/strict';
import test from 'node:test';

import { NextRequest } from 'next/server';

test('/api 请求会保留原始 request headers，并额外注入 x-request-id', async () => {
  const middlewareModule = await import('./middleware');
  const middleware = middlewareModule.middleware;

  assert.equal(typeof middleware, 'function');

  const request = new NextRequest('https://example.com/api/auth/sign-up/email', {
    headers: {
      'content-type': 'application/json',
      'x-auth-smoke': '1',
    },
  });

  const response = await middleware(request);
  const overrideHeaders = (
    response.headers.get('x-middleware-override-headers') ?? ''
  ).split(',');

  assert.equal(
    response.headers.get('x-middleware-request-content-type'),
    'application/json'
  );
  assert.equal(
    response.headers.get('x-middleware-request-x-pathname'),
    '/api/auth/sign-up/email'
  );
  assert.equal(
    response.headers.get('x-middleware-request-x-url'),
    'https://example.com/api/auth/sign-up/email'
  );
  assert.equal(response.headers.get('x-middleware-request-x-auth-smoke'), '1');
  assert.ok(overrideHeaders.includes('content-type'));
  assert.ok(overrideHeaders.includes('x-pathname'));
  assert.ok(overrideHeaders.includes('x-url'));
  assert.ok(overrideHeaders.includes('x-auth-smoke'));

  const requestId = response.headers.get('x-request-id');
  assert.ok(requestId);
  assert.equal(
    response.headers.get('x-middleware-request-x-request-id'),
    requestId
  );
  assert.ok(overrideHeaders.includes('x-request-id'));
});
