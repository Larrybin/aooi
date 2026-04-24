import assert from 'node:assert/strict';
import test from 'node:test';

import { NotFoundError } from '@/shared/lib/api/errors';

import { withApi } from './route';

test('withApi: internalMeta 只进日志不进响应 JSON', async () => {
  const logs: Array<{ message: string; meta?: unknown }> = [];
  const originalConsoleInfo = console.info;

  console.info = ((message: string, meta?: unknown) => {
    logs.push({ message, meta });
  }) as typeof console.info;

  try {
    const handler = withApi(async () => {
      throw new NotFoundError('not found', undefined, {
        internalMeta: { reason: 'capability_disabled' },
      });
    });

    const response = await handler(
      new Request('https://example.com/api/payment/checkout', {
        headers: {
          'x-request-id': 'req_internal_meta',
        },
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    assert.equal(response.status, 404);
    assert.equal(body.message, 'not found');
    assert.equal('internalMeta' in body, false);
    assert.equal('reason' in body, false);
    assert.equal(
      logs.some(
        (entry) =>
          entry.message === '[api] handled business error' &&
          JSON.stringify(entry.meta).includes('capability_disabled')
      ),
      true
    );
  } finally {
    console.info = originalConsoleInfo;
  }
});
