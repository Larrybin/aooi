import assert from 'node:assert/strict';
import test from 'node:test';

import {
  shouldPrintServerWorkerAuthDebug,
  syncWorkerStringBindingsToProcessEnv,
} from '../cloudflare/workers/create-server-worker';

test('shouldPrintServerWorkerAuthDebug 在 binding-only auth debug 场景下返回 true', () => {
  const previousDebugFlag = process.env.CF_LOCAL_AUTH_DEBUG;
  delete process.env.CF_LOCAL_AUTH_DEBUG;

  try {
    const shouldPrint = shouldPrintServerWorkerAuthDebug(
      new Request('https://example.com/api/auth/session'),
      {
        bindings: {
          CF_LOCAL_AUTH_DEBUG: 'true',
        },
      }
    );

    assert.equal(shouldPrint, true);
  } finally {
    if (previousDebugFlag === undefined) {
      delete process.env.CF_LOCAL_AUTH_DEBUG;
    } else {
      process.env.CF_LOCAL_AUTH_DEBUG = previousDebugFlag;
    }
  }
});

test('syncWorkerStringBindingsToProcessEnv 会把字符串 bindings 同步到 process.env', () => {
  const previousSecret = process.env.BETTER_AUTH_SECRET;
  delete process.env.BETTER_AUTH_SECRET;

  try {
    syncWorkerStringBindingsToProcessEnv({
      BETTER_AUTH_SECRET: 'binding-secret',
      NON_STRING_BINDING: { ignored: true },
    });

    assert.equal(process.env.BETTER_AUTH_SECRET, 'binding-secret');
    assert.equal(process.env.NON_STRING_BINDING, undefined);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.BETTER_AUTH_SECRET;
    } else {
      process.env.BETTER_AUTH_SECRET = previousSecret;
    }
  }
});
