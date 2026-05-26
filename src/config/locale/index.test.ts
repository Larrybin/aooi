import assert from 'node:assert/strict';
import test from 'node:test';
import { site } from '@/site';

import {
  defaultLocale,
  isRtlLocale,
  localeHreflangs,
  localeNames,
  locales,
  rtlLocales,
} from './index';
import { localeRegistry } from './registry';

test('active locales are derived from the current site config', () => {
  assert.deepEqual(locales, site.i18n.supportedLocales);
  assert.equal(defaultLocale, site.i18n.defaultLocale);
});

test('locale metadata is derived from the locale registry', () => {
  assert.deepEqual(
    rtlLocales,
    localeRegistry
      .filter((entry) => entry.direction === 'rtl')
      .map((entry) => entry.code)
  );

  for (const entry of localeRegistry) {
    assert.equal(localeNames[entry.code], entry.name);
    assert.equal(localeHreflangs[entry.code], entry.hreflang);
    assert.equal(isRtlLocale(entry.code), entry.direction === 'rtl');
  }
});
