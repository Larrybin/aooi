import assert from 'node:assert/strict';
import test from 'node:test';

import { getOrCreateRequestId } from './request-id.server';
import { getRequestContext } from './request-context.server';

test('getOrCreateRequestId 优先使用 x-request-id', () => {
  const headers = new Headers({
    'x-request-id': 'req_primary',
    'x-vercel-id': 'vercel_fallback',
    'cf-ray': 'cf_fallback',
  });

  assert.equal(getOrCreateRequestId(headers), 'req_primary');
});

test('getOrCreateRequestId 在 x-request-id 缺失时回退到 x-vercel-id 或 cf-ray', () => {
  assert.equal(
    getOrCreateRequestId(new Headers({ 'x-vercel-id': 'vercel_only' })),
    'vercel_only'
  );
  assert.equal(
    getOrCreateRequestId(new Headers({ 'cf-ray': 'cf_only' })),
    'cf_only'
  );
});

test('getOrCreateRequestId 会忽略非法 x-request-id 并生成新 id', () => {
  const headers = new Headers({
    'x-request-id': ` ${'x'.repeat(240)} `,
  });

  const requestId = getOrCreateRequestId(headers);
  assert.equal(typeof requestId, 'string');
  assert.notEqual(requestId, 'x'.repeat(240));
  assert.ok(requestId.length > 0);
});

test('getRequestContext 会提取 route/requestId/method', () => {
  const req = new Request('https://example.com/api/chat?x=1', {
    method: 'POST',
    headers: {
      'x-request-id': 'req_ctx',
    },
  });

  assert.deepEqual(getRequestContext(req), {
    route: '/api/chat',
    requestId: 'req_ctx',
    method: 'POST',
  });
});
