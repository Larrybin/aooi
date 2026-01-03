import assert from 'node:assert/strict';
import test from 'node:test';

import { UpstreamError } from './errors';

test('UpstreamError: 对外 publicMessage 固定为安全文案', () => {
  const err502 = new UpstreamError(502, 'upstream secret detail');
  assert.equal(err502.status, 502);
  assert.equal(err502.publicMessage, 'bad gateway');
  assert.equal(err502.message, 'upstream secret detail');

  const err503 = new UpstreamError(503, 'upstream secret detail');
  assert.equal(err503.status, 503);
  assert.equal(err503.publicMessage, 'service unavailable');
  assert.equal(err503.message, 'upstream secret detail');
});
