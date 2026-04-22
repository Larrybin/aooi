import assert from 'node:assert/strict';
import test from 'node:test';

import { site } from '@/site';

import { buildCanonicalUrl, buildLanguageAlternates } from './canonical';

test('buildCanonicalUrl: 使用 @/site 作为唯一 canonical base', () => {
  assert.equal(buildCanonicalUrl('/pricing'), `${site.brand.appUrl}/pricing`);
  assert.equal(buildCanonicalUrl('/pricing', 'zh'), `${site.brand.appUrl}/zh/pricing`);
});

test('buildLanguageAlternates: 所有 alternates 共享 canonical helper', () => {
  const alternates = buildLanguageAlternates('/pricing');

  assert.equal(alternates?.en, `${site.brand.appUrl}/pricing`);
});
