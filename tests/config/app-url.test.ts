import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/site';

test('site.brand.appUrl 是应用 identity URL 唯一来源', () => {
  assert.equal(typeof site.brand.appUrl, 'string');
  assert.equal(new URL(site.brand.appUrl).origin, site.brand.appUrl);
});
