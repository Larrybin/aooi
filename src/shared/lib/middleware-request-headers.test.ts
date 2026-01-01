import assert from 'node:assert/strict';
import test from 'node:test';

import { upsertMiddlewareRequestHeader } from './middleware-request-headers';

test('no-op when response is not continuing', () => {
  const headers = new Headers();
  upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_1');

  assert.equal(headers.get('x-middleware-request-x-request-id'), null);
  assert.equal(headers.get('x-middleware-override-headers'), null);
});

test('adds x-request-id override when no existing overrides', () => {
  const headers = new Headers([['x-middleware-next', '1']]);
  upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_2');

  assert.equal(headers.get('x-middleware-request-x-request-id'), 'req_2');
  assert.equal(headers.get('x-middleware-override-headers'), 'x-request-id');
});

test('preserves existing override headers (e.g. next-intl locale)', () => {
  const headers = new Headers([
    ['x-middleware-rewrite', '1'],
    ['x-middleware-override-headers', 'X-NEXT-INTL-LOCALE'],
    ['x-middleware-request-X-NEXT-INTL-LOCALE', 'zh'],
  ]);

  upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_3');

  assert.equal(
    headers.get('x-middleware-override-headers'),
    'X-NEXT-INTL-LOCALE,x-request-id'
  );
  assert.equal(headers.get('x-middleware-request-X-NEXT-INTL-LOCALE'), 'zh');
  assert.equal(headers.get('x-middleware-request-x-request-id'), 'req_3');
});

test('matches existing casing when header already exists in overrides', () => {
  const headers = new Headers([
    ['x-middleware-next', '1'],
    ['x-middleware-override-headers', 'X-Request-Id'],
  ]);

  upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_4');

  assert.equal(headers.get('x-middleware-override-headers'), 'X-Request-Id');
  assert.equal(headers.get('x-middleware-request-X-Request-Id'), 'req_4');
});
