import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveAppUrl } from '@/config';

test('resolveAppUrl 优先使用显式 NEXT_PUBLIC_APP_URL', () => {
  assert.equal(
    resolveAppUrl({
      rawAppUrl: 'https://example.com/foo?bar=baz',
      nodeEnv: 'production',
      buildTime: false,
      browserOrigin: 'http://127.0.0.1:8787',
    }),
    'https://example.com'
  );
});

test('resolveAppUrl 在浏览器侧缺少 env 时回退当前 origin', () => {
  assert.equal(
    resolveAppUrl({
      rawAppUrl: '',
      nodeEnv: 'production',
      buildTime: false,
      browserOrigin: 'http://127.0.0.1:8787',
    }),
    'http://127.0.0.1:8787'
  );
});

test('resolveAppUrl 在生产服务端缺少 env 且无浏览器 origin 时抛错', () => {
  assert.throws(
    () =>
      resolveAppUrl({
        rawAppUrl: '',
        nodeEnv: 'production',
        buildTime: false,
        browserOrigin: null,
      }),
    /NEXT_PUBLIC_APP_URL is required in production/
  );
});

test('resolveAppUrl 在构建阶段缺少 env 时回退 localhost', () => {
  assert.equal(
    resolveAppUrl({
      rawAppUrl: '',
      nodeEnv: 'production',
      buildTime: true,
      browserOrigin: null,
    }),
    'http://localhost:3000'
  );
});
