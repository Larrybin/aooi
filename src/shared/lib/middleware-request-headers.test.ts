import assert from 'node:assert/strict';

import { upsertMiddlewareRequestHeader } from './middleware-request-headers';

type TestCase = { name: string; run: () => void };

const tests: TestCase[] = [
  {
    name: 'no-op when response is not continuing',
    run: () => {
      const headers = new Headers();
      upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_1');

      assert.equal(headers.get('x-middleware-request-x-request-id'), null);
      assert.equal(headers.get('x-middleware-override-headers'), null);
    },
  },
  {
    name: 'adds x-request-id override when no existing overrides',
    run: () => {
      const headers = new Headers([['x-middleware-next', '1']]);
      upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_2');

      assert.equal(headers.get('x-middleware-request-x-request-id'), 'req_2');
      assert.equal(
        headers.get('x-middleware-override-headers'),
        'x-request-id'
      );
    },
  },
  {
    name: 'preserves existing override headers (e.g. next-intl locale)',
    run: () => {
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
      assert.equal(
        headers.get('x-middleware-request-X-NEXT-INTL-LOCALE'),
        'zh'
      );
      assert.equal(headers.get('x-middleware-request-x-request-id'), 'req_3');
    },
  },
  {
    name: 'matches existing casing when header already exists in overrides',
    run: () => {
      const headers = new Headers([
        ['x-middleware-next', '1'],
        ['x-middleware-override-headers', 'X-Request-Id'],
      ]);

      upsertMiddlewareRequestHeader(headers, 'x-request-id', 'req_4');

      assert.equal(
        headers.get('x-middleware-override-headers'),
        'X-Request-Id'
      );
      assert.equal(headers.get('x-middleware-request-X-Request-Id'), 'req_4');
    },
  },
];

let failed = false;
for (const testCase of tests) {
  try {
    testCase.run();
  } catch (error) {
    failed = true;
    console.error(`[FAIL] ${testCase.name}`);
    console.error(error);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log(`[OK] ${tests.length} tests passed`);
}
