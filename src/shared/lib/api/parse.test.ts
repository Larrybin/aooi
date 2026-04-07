import assert from 'node:assert/strict';
import test from 'node:test';

import { PayloadTooLargeError } from './errors';
import {
  readRequestBodyByteCountUpTo,
  readRequestFormData,
  readRequestTextWithLimit,
} from '../runtime/request-body';

test('readRequestTextWithLimit: 正常 body 可读取', async () => {
  const req = new Request('https://example.com/api/test', {
    method: 'POST',
    body: 'hello',
  });

  const text = await readRequestTextWithLimit(req, 1024);
  assert.equal(text, 'hello');
});

test('readRequestTextWithLimit: 超限抛出 413', async () => {
  const oversized = 'a'.repeat(128);
  const req = new Request('https://example.com/api/test', {
    method: 'POST',
    body: oversized,
  });

  await assert.rejects(
    async () => readRequestTextWithLimit(req, 32),
    (error) => {
      assert.equal(error instanceof PayloadTooLargeError, true);
      assert.equal((error as PayloadTooLargeError).status, 413);
      return true;
    }
  );
});

test('readRequestBodyByteCountUpTo: 超限时返回截断信息', async () => {
  const req = new Request('https://example.com/api/test', {
    method: 'POST',
    body: 'abcdef',
  });

  const result = await readRequestBodyByteCountUpTo(req, 3);

  assert.deepEqual(result, {
    bytesRead: 3,
    truncated: true,
  });
});

test('readRequestFormData: 统一返回 formData', async () => {
  const formData = new FormData();
  formData.set('name', 'roller-rabbit');
  const req = new Request('https://example.com/api/test', {
    method: 'POST',
    body: formData,
  });

  const parsed = await readRequestFormData(req);

  assert.equal(parsed.get('name'), 'roller-rabbit');
});
