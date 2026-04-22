/* eslint-disable no-console */
import assert from 'node:assert/strict';
import test from 'node:test';

import { createUseCaseLogger, redact } from './logger.server';

test('redact 会隐藏敏感字段并保留普通字段', () => {
  const redacted = redact({
    password: 'secret',
    token: 'token-value',
    nested: {
      api_key: 'abc',
      ok: 'value',
    },
  }) as Record<string, unknown>;

  assert.equal(redacted.password, '[REDACTED]');
  assert.equal(redacted.token, '[REDACTED]');
  assert.deepEqual(redacted.nested, {
    api_key: '[REDACTED]',
    ok: 'value',
  });
});

test('createUseCaseLogger 返回绑定 domain/useCase/operation/requestId 的 logger', () => {
  const logger = createUseCaseLogger({
    domain: 'billing',
    useCase: 'checkout',
    operation: 'create-checkout-session',
    requestId: 'req_123',
  });

  assert.equal(typeof logger.debug, 'function');
  assert.equal(typeof logger.info, 'function');
  assert.equal(typeof logger.warn, 'function');
  assert.equal(typeof logger.error, 'function');
});

test('logger.with 会合并上下文 meta', () => {
  const messages: Array<[string, unknown?]> = [];
  const originalInfo = console.info;

  console.info = ((message: string, meta?: unknown) => {
    messages.push([message, meta]);
  }) as typeof console.info;

  try {
    const logger = createUseCaseLogger({
      domain: 'chat',
      useCase: 'stream',
      operation: 'persist-message',
      requestId: 'req_meta',
    });

    logger.info('test merge', { assistantMessageId: 'msg_1' });
  } finally {
    console.info = originalInfo;
  }

  assert.equal(messages.length, 1);
  assert.deepEqual(messages[0], [
    'test merge',
    {
      requestId: 'req_meta',
      domain: 'chat',
      useCase: 'stream',
      operation: 'persist-message',
      assistantMessageId: 'msg_1',
    },
  ]);
});
