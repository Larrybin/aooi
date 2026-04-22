import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/site';

import { buildBrandPlaceholderValues } from './placeholders.server';

test('buildBrandPlaceholderValues: 站点 identity 只来自 @/site', () => {
  const brand = buildBrandPlaceholderValues();

  assert.equal(brand.appName, site.brand.appName);
  assert.equal(brand.appUrl, site.brand.appUrl);
  assert.equal(brand.appLogo, site.brand.logo);
  assert.equal(brand.appFavicon, site.brand.favicon);
  assert.equal(brand.appOgImage, site.brand.previewImage);
  assert.equal(brand.supportEmail, site.brand.supportEmail);
});
