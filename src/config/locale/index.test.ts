import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isRtlLocale,
  localeHreflangs,
  localeNames,
  locales,
  rtlLocales,
} from './index';
import { localeRegistry } from './registry';

test('locale exports are derived from the locale registry', () => {
  assert.deepEqual(
    locales,
    localeRegistry.map((entry) => entry.code)
  );
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
