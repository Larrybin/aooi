import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAdsTxtResponse } from './response';

test('buildAdsTxtResponse: 返回 text/plain 响应', async () => {
  const response = buildAdsTxtResponse('google.com, pub-123, DIRECT');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'text/plain');
  assert.equal(await response.text(), 'google.com, pub-123, DIRECT');
});

test('buildAdsTxtResponse: 允许空正文', async () => {
  const response = buildAdsTxtResponse('');

  assert.equal(response.status, 200);
  assert.equal(await response.text(), '');
});
