import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatMessageWithRequestId,
  getRequestIdFromError,
  getRequestIdFromResponse,
  RequestIdError,
} from './request-id';

test('RequestIdError 保留 requestId/status/url', () => {
  const error = new RequestIdError('failed', 'req_1', {
    status: 503,
    url: 'https://example.com/api',
  });

  assert.equal(error.requestId, 'req_1');
  assert.equal(error.status, 503);
  assert.equal(error.url, 'https://example.com/api');
});

test('getRequestIdFromResponse 读取 x-request-id 并回退到 x-vercel-id/cf-ray', () => {
  assert.equal(
    getRequestIdFromResponse(
      new Response(null, {
        headers: { 'x-request-id': 'req_primary' },
      })
    ),
    'req_primary'
  );
  assert.equal(
    getRequestIdFromResponse(
      new Response(null, {
        headers: { 'x-vercel-id': 'vercel_only' },
      })
    ),
    'vercel_only'
  );
  assert.equal(
    getRequestIdFromResponse(
      new Response(null, {
        headers: { 'cf-ray': 'cf_only' },
      })
    ),
    'cf_only'
  );
});

test('getRequestIdFromError 和 formatMessageWithRequestId 保持 client-safe 行为', () => {
  const error = new RequestIdError('boom', 'req_3', { status: 500 });

  assert.equal(getRequestIdFromError(error), 'req_3');
  assert.equal(
    formatMessageWithRequestId('request failed', 'req_3'),
    'request failed (requestId: req_3)'
  );
  assert.equal(formatMessageWithRequestId('request failed'), 'request failed');
});
