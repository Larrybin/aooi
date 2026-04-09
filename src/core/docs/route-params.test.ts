import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDocsSlug, resolveDocsLocale } from './route-params';

test('normalizeDocsSlug 会把 docs 根页 rewrite 的 index slug 还原成空 slug', () => {
  assert.deepEqual(normalizeDocsSlug(), []);
  assert.deepEqual(normalizeDocsSlug([]), []);
  assert.deepEqual(normalizeDocsSlug(['index']), []);
  assert.deepEqual(normalizeDocsSlug(['quick-start']), ['quick-start']);
  assert.deepEqual(normalizeDocsSlug(['guide', 'index']), ['guide', 'index']);
});

test('resolveDocsLocale: docs 不支持的 locale 回退到 en', () => {
  assert.equal(resolveDocsLocale(), 'en');
  assert.equal(resolveDocsLocale('en'), 'en');
  assert.equal(resolveDocsLocale('zh'), 'zh');
  assert.equal(resolveDocsLocale('zh-TW'), 'en');
  assert.equal(resolveDocsLocale('fr'), 'en');
});
