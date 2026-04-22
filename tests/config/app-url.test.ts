import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/site';

test('site.brand.appUrl 是应用 identity URL 唯一来源', () => {
  assert.equal(site.brand.appUrl, 'http://localhost:3000');
});
